import { supabaseAdmin } from "./supabase.js";
import {
  FREE_TIER_LIMIT,
  getLimitForPlan,
  normalizePlan,
} from "../constants/plans.js";

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
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function getAuthUserRow(userId) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, is_pro, plan, usage_this_month, usage_limit, quota_reset_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getExtensionAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from("extension_accounts")
    .select("id, plan, usage_this_month, usage_limit, quota_reset_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createExtensionAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from("extension_accounts")
    .insert({ id: userId })
    .select("id, plan, usage_this_month, usage_limit, quota_reset_at")
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
    const plan =
      authUser.is_pro === true ? "pro" : normalizePlan(authUser.plan);
    const limit = resolveMonthlyLimit(authUser, plan);
    const usedThisMonth = authUser.usage_this_month ?? 0;
    return {
      source: "users",
      id: authUser.id,
      plan,
      usedThisMonth,
      limit,
      remainingCredits: Math.max(0, limit - usedThisMonth),
    };
  }

  let ext = await getExtensionAccount(userId);
  if (!ext) {
    ext = await createExtensionAccount(userId);
  }
  ext = await maybeResetUsage(ext, "extension_accounts");
  const plan = normalizePlan(ext.plan);
  const limit = resolveMonthlyLimit(ext, plan);
  const usedThisMonth = ext.usage_this_month ?? 0;
  return {
    source: "extension_accounts",
    id: ext.id,
    plan,
    usedThisMonth,
    limit,
    remainingCredits: Math.max(0, limit - usedThisMonth),
  };
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
    authUser != null
      ? authUser.is_pro === true
      : account.plan === "pro" || account.plan === "plus";

  const remaining = Math.max(0, account.limit - account.usedThisMonth);

  return {
    isPro,
    tier: isPro ? "pro" : "free",
    tierLabel: isPro ? "Pro Tier" : "Free Tier",
    usedThisMonth: account.usedThisMonth,
    limit: account.limit,
    remaining,
    unlimited: isPro,
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

  const { data: authUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (authUser) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ is_pro: pro })
      .eq("id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from("extension_accounts")
    .upsert({ id: userId, plan: pro ? "pro" : "free" }, { onConflict: "id" });
  if (error) throw error;
}
