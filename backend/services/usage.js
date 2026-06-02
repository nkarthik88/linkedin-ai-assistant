import { supabaseAdmin } from "./supabase.js";
import { config } from "../config.js";
import {
  FREE_TIER_LIMIT,
  getLimitForPlan,
  getLeadLimitForPlan,
  getFeatureLimitForPlan,
  normalizePlan,
} from "../constants/plans.js";

const OWNER_LIMIT = 999999;

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
  if (plan === "pro" || plan === "plus") {
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

async function maybeResetUsage(row, table) {
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
    .select("id, plan, email, usage_this_month, usage_limit, quota_reset_at, feature_usage")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createExtensionAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from("extension_accounts")
    .insert({ id: userId })
    .select("id, plan, email, usage_this_month, usage_limit, quota_reset_at")
    .single();

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
    const plan = owner
      ? "pro"
      : authUser.is_pro === true
      ? "pro"
      : normalizePlan(authUser.plan);
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
    ext = await createExtensionAccount(userId);
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
      : account.plan === "pro" || account.plan === "plus");

  const remaining = Math.max(0, account.limit - account.usedThisMonth);

  // Build per-feature usage summary
  const featureUsage = account.featureUsage ?? {};
  const TRACKED_FEATURES = ["generate_post", "personalized_dm", "reply_comment", "improve_headline", "viral_rewriter"];
  const feature_usage = {};
  for (const f of TRACKED_FEATURES) {
    const used = featureUsage[f] ?? 0;
    const limit = isPro ? null : getFeatureLimitForPlan(f, account.plan);
    feature_usage[f] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      unlimited: isPro,
    };
  }

  return {
    isPro,
    isOwner: Boolean(account.isOwner),
    tier: account.isOwner ? "owner" : isPro ? "pro" : "free",
    tierLabel: account.isOwner ? "Owner" : isPro ? "Pro Tier" : "Free Tier",
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

  // Pro / owner → unlimited, just return account state
  if (account.isOwner || account.plan === "pro" || account.plan === "plus") {
    return { ...account, featureRemaining: null };
  }

  const featureUsage = account.featureUsage ?? {};
  const used = featureUsage[feature] ?? 0;
  const limit = getFeatureLimitForPlan(feature, account.plan);

  if (limit !== null && used >= limit) {
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
    generate_post: "post generations",
    personalized_dm: "DM generations",
    reply_comment: "reply generations",
    improve_headline: "headline generations",
    viral_rewriter: "viral rewrites",
  };
  return labels[feature] ?? "generations";
}

/**
 * Consume one Find Leads search. Enforces the per-plan monthly lead cap
 * (free: 2, pro/plus: 50). If the lead column isn't present yet, it degrades
 * to allowing the search rather than erroring.
 */
export async function consumeLeadSearch(userId) {
  const account = await resolveAccount(userId);
  const limit = account.leadSearchLimit;
  const used = account.leadSearchesUsed;

  if (account.leadTrackable && used >= limit) {
    const err = new Error(
      account.plan === "pro" || account.plan === "plus"
        ? "You've used all 50 lead searches this month. Resets next month."
        : "You've used all 5 free lead searches this month. Upgrade to Pro for 50/month."
    );
    err.statusCode = 402;
    err.leadLimit = true;
    err.isPro = account.plan === "pro" || account.plan === "plus";
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
    ? { feature_usage: {}, lead_searches_this_month: 0 }
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
