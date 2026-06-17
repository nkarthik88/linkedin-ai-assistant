import { supabaseAdmin } from "./supabase.js";
import { config } from "../config.js";
import {
  FREE_TIER_LIMIT,
  getLimitForPlan,
  getLeadLimitForPlan,
  getFeatureLimitForPlan,
  normalizePlan,
  isLinkedInUnlimited,
  isRedditUnlimited,
  REDDIT_FREE_LIMITS,
} from "../constants/plans.js";

const OWNER_LIMIT = 999999;

/**
 * Fire-and-forget funnel event logger. Never throws — analytics must never block a response.
 * Events: onboarded | feature_used | limit_hit | upgrade_initiated | payment_completed
 */
export async function logFunnelEvent({ userId, event, feature = null, plan = null, meta = null }) {
  try {
    await supabaseAdmin.from("funnel_events").insert({
      user_id: String(userId),
      event,
      feature: feature ?? null,
      plan: plan ?? null,
      meta: meta ?? null,
    });
  } catch { /* non-critical */ }
}

function isOwnerEmail(email) {
  if (!email) return false;
  return config.ownerEmails.includes(String(email).trim().toLowerCase());
}

/**
 * Read lead-search usage defensively. Returns null if the
 * `lead_searches_this_month` column doesn't exist yet (migration not applied),
 * so the feature degrades to "untracked" instead of throwing.
 */
async function getLeadSearchesUsed(table, id) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("lead_searches_this_month")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data?.lead_searches_this_month ?? 0;
}

async function withLeadUsage(account) {
  const used = await getLeadSearchesUsed(account.source, account.id);
  const limit = getLeadLimitForPlan(account.plan);
  return {
    ...account,
    leadTrackable: used !== null,
    leadSearchesUsed: used ?? 0,
    leadSearchLimit: limit,
    leadSearchesRemaining: Math.max(0, limit - (used ?? 0)),
  };
}

function resolveMonthlyLimit(row, plan) {
  if (isLinkedInUnlimited(plan)) {
    return getLimitForPlan(plan);
  }
  const fromDb = row?.usage_limit;
  if (typeof fromDb === "number" && fromDb > 0) {
    return fromDb;
  }
  return FREE_TIER_LIMIT;
}

function nextQuotaReset(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function shouldResetQuota(quotaResetAt) {
  if (!quotaResetAt) return true;
  return new Date(quotaResetAt).getTime() <= Date.now();
}

async function sanitizeFeatureUsage(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = rawToUsed(v); // flatten any {used,limit} objects to plain numbers
  }
  return out;
}

async function maybeResetUsage(row, table) {
  // Auto-heal corrupted feature_usage (object values instead of numbers)
  const rawUsage = row.feature_usage ?? {};
  const hasCorruption = Object.values(rawUsage).some(v => v !== null && typeof v === "object");
  if (hasCorruption) {
    const healed = await sanitizeFeatureUsage(rawUsage);
    await supabaseAdmin.from(table).update({ feature_usage: healed }).eq("id", row.id).then(() => {}).catch(() => {});
    row = { ...row, feature_usage: healed };
  }

  if (!shouldResetQuota(row.quota_reset_at)) {
    return row;
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .update({
      usage_this_month: 0,
      quota_reset_at: nextQuotaReset(),
      feature_usage: {},
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) throw error;

  // Best-effort: reset the lead counter too. Ignored if column doesn't exist.
  try {
    await supabaseAdmin
      .from(table)
      .update({ lead_searches_this_month: 0 })
      .eq("id", row.id);
  } catch {
    /* column not present yet — non-fatal */
  }

  return data;
}

async function getAuthUserRow(userId) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, is_pro, plan, usage_this_month, usage_limit, quota_reset_at, feature_usage"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getExtensionAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from("extension_accounts")
    .select("id, plan, email, canonical_email, usage_this_month, usage_limit, quota_reset_at, feature_usage, blocked_reason")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Resolve account for generate/usage. Prefers auth `users` row, else extension_accounts.
 */
export async function resolveAccount(userId) {
  let authUser = await getAuthUserRow(userId);
  if (authUser) {
    authUser = await maybeResetUsage(authUser, "users");
    // Payment status is tracked via `users.is_pro`.
    // Keep `plan` as a fallback for legacy rows, but prefer `is_pro`.
    const owner = isOwnerEmail(authUser.email);
    // Prefer the stored plan string (supports linkedin_pro/reddit_pro/bundle).
    // Fall back to "pro" for legacy rows that have is_pro:true but no plan string.
    const normalizedPlan = normalizePlan(authUser.plan);
    const plan = owner
      ? "pro"
      : normalizedPlan !== "free"
      ? normalizedPlan
      : authUser.is_pro === true
      ? "pro"
      : "free";
    const limit = owner ? OWNER_LIMIT : resolveMonthlyLimit(authUser, plan);
    const usedThisMonth = authUser.usage_this_month ?? 0;
    return withLeadUsage({
      source: "users",
      id: authUser.id,
      plan,
      isOwner: owner,
      email: authUser.email || null,
      usedThisMonth,
      limit,
      quotaResetAt: authUser.quota_reset_at || null,
      remainingCredits: Math.max(0, limit - usedThisMonth),
      featureUsage: authUser.feature_usage ?? {},
    });
  }

  let ext = await getExtensionAccount(userId);
  if (!ext) {
    // Never auto-create a row without an email — that produces NULL-email rows.
    // Only /api/auth/register-extension (which requires email) may create rows.
    const err = new Error("Free trial limit reached on this device. Please sign in with the email you originally used, or upgrade to continue.");
    err.statusCode = 404;
    err.notRegistered = true;
    throw err;
  }
  if (ext.blocked_reason) {
    logFunnelEvent({ userId, event: "limit_reached", plan: "free", meta: { blocked_reason: ext.blocked_reason } }).catch(() => {});
    const err = new Error(
      "Your free trial has ended. Please upgrade to continue — choose a plan that fits your needs."
    );
    err.statusCode = 402;
    err.blocked = true;
    err.blockedReason = ext.blocked_reason;
    throw err;
  }
  ext = await maybeResetUsage(ext, "extension_accounts");
  const owner = isOwnerEmail(ext.email);
  const plan = owner ? "pro" : normalizePlan(ext.plan);
  const limit = owner ? OWNER_LIMIT : resolveMonthlyLimit(ext, plan);
  const usedThisMonth = ext.usage_this_month ?? 0;
  return withLeadUsage({
    source: "extension_accounts",
    id: ext.id,
    plan,
    isOwner: owner,
    email: ext.email || null,
    usedThisMonth,
    limit,
    quotaResetAt: ext.quota_reset_at || null,
    remainingCredits: Math.max(0, limit - usedThisMonth),
    featureUsage: ext.feature_usage ?? {},
  });
}

export async function getUsageSummary(userId) {
  const account = await resolveAccount(userId);
  return {
    plan: account.plan,
    usedThisMonth: account.usedThisMonth,
    limit: account.limit,
  };
}

/**
 * Account status for extension popup (tier, usage, Pro flag).
 * Auth users: `users.is_pro`. Extension-only users: `extension_accounts.plan`.
 */
export async function getAccountStatus(userId) {
  const account = await resolveAccount(userId);
  const authUser = await getAuthUserRow(userId);
  const isPro =
    account.isOwner ||
    (authUser != null
      ? authUser.is_pro === true
      : isLinkedInUnlimited(account.plan));

  const remaining = Math.max(0, account.limit - account.usedThisMonth);

  // Build per-feature usage summary (LinkedIn features)
  const featureUsage = account.featureUsage ?? {};
  const isLinkedInPro = isLinkedInUnlimited(account.plan);
  const isRedditPro   = isRedditUnlimited(account.plan);

  const TRACKED_FEATURES = ["generate_post", "personalized_dm", "reply_comment", "improve_headline", "viral_rewriter"];
  const feature_usage = {};
  for (const f of TRACKED_FEATURES) {
    const used = rawToUsed(featureUsage[f]);
    const limit = isLinkedInPro ? null : getFeatureLimitForPlan(f, account.plan);
    feature_usage[f] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: isLinkedInPro,
    };
  }

  // Reddit feature usage (reddit_pro/bundle = unlimited; free/linkedin_pro = limited)
  const REDDIT_FEATURES = ["reddit_post", "reddit_subreddit", "reddit_reply"];
  for (const f of REDDIT_FEATURES) {
    const used = rawToUsed(featureUsage[f]);
    const limit = isRedditPro ? null : (REDDIT_FREE_LIMITS[f] ?? null);
    feature_usage[f] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: isRedditPro,
    };
  }

  const plan = account.plan;
  const tierLabel = account.isOwner
    ? "Owner"
    : plan === "bundle"       ? "Bundle"
    : plan === "linkedin_pro" ? "LinkedIn Pro"
    : plan === "reddit_pro"   ? "Reddit Pro"
    : isPro                   ? "Pro Tier"
    : "Free Tier";

  return {
    isPro,
    plan,
    isOwner: Boolean(account.isOwner),
    tier: account.isOwner ? "owner" : isPro ? "pro" : "free",
    tierLabel,
    usedThisMonth: account.usedThisMonth,
    limit: account.limit,
    remaining,
    unlimited: isPro,
    lead_searches_used: account.leadSearchesUsed,
    lead_searches_limit: account.leadSearchLimit,
    lead_searches_remaining: account.leadSearchesRemaining,
    resets_on: account.quotaResetAt || null,
    feature_usage,
  };
}

export async function consumeCredit(userId) {
  const account = await resolveAccount(userId);

  if (account.usedThisMonth >= account.limit) {
    const err = new Error("Monthly usage limit reached. Upgrade your plan for more generations.");
    err.statusCode = 402;
    throw err;
  }

  const table = account.source;
  const newUsage = account.usedThisMonth + 1;

  const { error } = await supabaseAdmin
    .from(table)
    .update({ usage_this_month: newUsage })
    .eq("id", userId);

  if (error) throw error;

  return {
    ...account,
    usedThisMonth: newUsage,
    remainingCredits: Math.max(0, account.limit - newUsage),
  };
}

/**
 * Consume one use of a specific feature. Pro accounts are unlimited.
 * Falls back to the shared credit pool if the feature is unknown.
 */
export async function consumeFeatureCredit(userId, feature) {
  const account = await resolveAccount(userId);

  // LinkedIn-unlimited plans → unlimited LinkedIn feature usage
  if (account.isOwner || isLinkedInUnlimited(account.plan)) {
    return { ...account, featureRemaining: null };
  }

  const featureUsage = account.featureUsage ?? {};
  const used = rawToUsed(featureUsage[feature]);
  const limit = getFeatureLimitForPlan(feature, account.plan);

  if (limit !== null && used >= limit) {
    logFunnelEvent({ userId, event: "limit_reached", feature, plan: account.plan, meta: { used, limit } }).catch(() => {});
    const err = new Error(
      `You've used all ${limit} free ${featureLabel(feature)} this month. Upgrade to Pro for unlimited.`
    );
    err.statusCode = 402;
    err.featureLimit = true;
    err.feature = feature;
    err.limit = limit;
    throw err;
  }

  const newUsed = used + 1;
  const updatedFeatureUsage = { ...featureUsage, [feature]: newUsed };

  const { error } = await supabaseAdmin
    .from(account.source)
    .update({ feature_usage: updatedFeatureUsage })
    .eq("id", userId);

  if (error) throw error;

  const remaining = limit === null ? null : Math.max(0, limit - newUsed);
  return {
    ...account,
    featureUsage: updatedFeatureUsage,
    featureRemaining: remaining,
    featureUsed: newUsed,
    featureLimit: limit,
  };
}

function featureLabel(feature) {
  const labels = {
    generate_post:    "post generations",
    personalized_dm:  "DM generations",
    reply_comment:    "reply generations",
    improve_headline: "headline generations",
    viral_rewriter:   "viral rewrites",
    reddit_post:      "Reddit post generations",
    reddit_subreddit: "subreddit searches",
    reddit_reply:     "Reddit reply generations",
    reddit_score:     "Reddit score checks",
    reddit_viral:     "viral rewrites",
  };
  return labels[feature] ?? "uses";
}

/**
 * Consume one Reddit feature use. reddit_pro/bundle = unlimited.
 * linkedin_pro and free both enforce REDDIT_FREE_LIMITS.
 */
// Normalize raw feature_usage value — handles both plain number and {used,limit} object
function rawToUsed(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object") return Number(val.used) || 0;
  return Number(val) || 0;
}

export async function consumeRedditFeatureCredit(userId, feature) {
  const account = await resolveAccount(userId);

  if (account.isOwner || isRedditUnlimited(account.plan)) {
    return { ...account, featureRemaining: null };
  }

  const featureUsage = account.featureUsage ?? {};
  const used = rawToUsed(featureUsage[feature]);
  const limit = REDDIT_FREE_LIMITS[feature] ?? null;

  console.log(`[usage] consumeRedditFeatureCredit userId=${userId} feature=${feature} used_before=${used} limit=${limit}`);

  if (limit !== null && used >= limit) {
    logFunnelEvent({ userId, event: "limit_reached", feature, plan: account.plan, meta: { used, limit } }).catch(() => {});
    const label = feature === "reddit_subreddit" ? "subreddit searches" : feature === "reddit_reply" ? "Reddit replies" : "Reddit posts";
    const err = new Error(
      `You've used all ${limit} free ${label} this month. Upgrade for unlimited Reddit access.`
    );
    err.statusCode = 402;
    err.featureLimit = true;
    err.feature = feature;
    err.limit = limit;
    throw err;
  }

  const newUsed = used + 1;
  console.log(`[usage] incrementing ${feature}: ${used} → ${newUsed} (userId=${userId})`);
  const updatedFeatureUsage = { ...featureUsage, [feature]: newUsed };

  const { error } = await supabaseAdmin
    .from(account.source)
    .update({ feature_usage: updatedFeatureUsage })
    .eq("id", userId);

  if (error) throw error;

  const remaining = limit === null ? null : Math.max(0, limit - newUsed);
  return {
    ...account,
    featureUsage: updatedFeatureUsage,
    featureRemaining: remaining,
    featureUsed: newUsed,
    featureLimit: limit,
  };
}

/**
 * Consume one Find Leads search. Enforces the per-plan monthly lead cap
 * (free: 5, pro/plus: 50). If the lead column isn't present yet, it degrades
 * to allowing the search rather than erroring.
 */
export async function consumeLeadSearch(userId) {
  const account = await resolveAccount(userId);
  const limit = account.leadSearchLimit;
  const used = account.leadSearchesUsed;

  if (account.leadTrackable && used >= limit) {
    const isHighLeadPlan = isLinkedInUnlimited(account.plan);
    const err = new Error(
      isHighLeadPlan
        ? `You've used all ${limit} lead searches this month. Resets next month.`
        : `You've used all ${limit} free lead searches this month. Upgrade to LinkedIn Pro or Bundle for ${25}/month.`
    );
    err.statusCode = 402;
    err.leadLimit = true;
    err.isPro = isHighLeadPlan;
    throw err;
  }

  const newUsed = used + 1;
  if (account.leadTrackable) {
    const { error } = await supabaseAdmin
      .from(account.source)
      .update({ lead_searches_this_month: newUsed })
      .eq("id", userId);
    if (error) {
      /* column disappeared mid-flight — don't block the user */
    }
  }

  return {
    ...account,
    leadSearchesUsed: newUsed,
    leadSearchesRemaining: Math.max(0, limit - newUsed),
  };
}

/**
 * Returns a Set of profile URLs previously returned to this user (cross-search dedup).
 * Best-effort: returns empty Set on any error.
 */
export async function getReturnedLeadUrls(userId, source = "extension_accounts") {
  try {
    const table = source === "users" ? "users" : "extension_accounts";
    const { data } = await supabaseAdmin
      .from(table)
      .select("returned_lead_urls")
      .eq("id", userId)
      .maybeSingle();
    const arr = Array.isArray(data?.returned_lead_urls) ? data.returned_lead_urls : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

/**
 * Append newly returned profile URLs to the stored dedup set. Best-effort: never throws.
 */
export async function appendReturnedLeadUrls(userId, source = "extension_accounts", urls) {
  if (!urls || urls.length === 0) return;
  try {
    const table = source === "users" ? "users" : "extension_accounts";
    const existing = await getReturnedLeadUrls(userId, source);
    urls.forEach((u) => existing.add(u));
    await supabaseAdmin
      .from(table)
      .update({ returned_lead_urls: [...existing] })
      .eq("id", userId);
  } catch {
    // silently ignore — dedup is best-effort
  }
}

/**
 * Record one Find Leads search for analytics. Best-effort: never throws, so a
 * missing table or insert error can't break the lead response.
 */
export async function logLeadSearchEvent({ userId, target, profilesCount, leadsCount, hotCount }) {
  try {
    await supabaseAdmin.from("lead_search_events").insert({
      user_id: userId ? String(userId) : null,
      target: target ? String(target).slice(0, 500) : null,
      profiles_count: profilesCount || 0,
      leads_count: leadsCount || 0,
      hot_count: hotCount || 0,
    });
  } catch {
    /* analytics is non-critical */
  }
}

export async function updatePlanForUser(userId, plan) {
  const normalized = normalizePlan(plan);
  const { data: authUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (authUser) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ plan: normalized })
      .eq("id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from("extension_accounts")
    .upsert({ id: userId, plan: normalized }, { onConflict: "id" });
  if (error) throw error;
}

export async function setProStatusForUser(userId, isPro) {
  const pro = Boolean(isPro);
  // On upgrade to Pro, reset per-feature usage so the user starts fresh.
  const resetFields = pro
    ? { feature_usage: {}, lead_searches_this_month: 0, usage_this_month: 0 }
    : {};

  const { data: authUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (authUser) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_pro: pro, ...resetFields })
      .eq("id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from("extension_accounts")
    .upsert(
      { id: userId, plan: pro ? "pro" : "free", ...resetFields },
      { onConflict: "id" }
    );
  if (error) throw error;
}
