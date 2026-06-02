/** Monthly generation cap for free-tier accounts (extension + auth). */
export const FREE_TIER_LIMIT = 10;

/** Monthly "Find Leads" search caps — tracked separately from generations. */
export const LEAD_FREE_LIMIT = 5;
export const LEAD_PRO_LIMIT = 50;

/** Per-feature monthly limits for free tier. Pro = unlimited (null). */
export const FEATURE_FREE_LIMITS = {
  generate_post: 10,
  personalized_dm: 10,
  reply_comment: 10,
  improve_headline: 10,
  viral_rewriter: 10,
};

export function getFeatureLimitForPlan(feature, plan) {
  if (plan === "pro" || plan === "plus") return null; // unlimited
  return FEATURE_FREE_LIMITS[feature] ?? FREE_TIER_LIMIT;
}

export function getLeadLimitForPlan(plan) {
  return plan === "pro" || plan === "plus" ? LEAD_PRO_LIMIT : LEAD_FREE_LIMIT;
}

export const PLAN_LIMITS = {
  free: FREE_TIER_LIMIT,
  pro: 500,
  plus: 2000,
};

export const PLAN_MODELS = {
  free: "openai/gpt-4o-mini",
  pro: "anthropic/claude-sonnet-4",
  plus: "anthropic/claude-sonnet-4",
};

export function getModelForPlan(plan) {
  if (plan === "pro" || plan === "plus") {
    return PLAN_MODELS.pro;
  }
  return PLAN_MODELS.free;
}

export function getLimitForPlan(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function normalizePlan(plan) {
  if (plan === "pro" || plan === "plus") return plan;
  return "free";
}
