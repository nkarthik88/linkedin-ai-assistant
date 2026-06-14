/** Monthly generation cap for free-tier accounts (extension + auth). */
export const FREE_TIER_LIMIT = 10;

/** Monthly "Find Leads" search caps — tracked separately from generations. */
export const LEAD_FREE_LIMIT = 5;
export const LEAD_PRO_LIMIT  = 25;  // linkedin_pro and bundle
export const LEAD_PLUS_LIMIT = 25;  // kept for legacy "plus" rows

/** Per-feature monthly limits by plan. null = unlimited. */
export const FEATURE_FREE_LIMITS = {
  generate_post:    5,
  personalized_dm:  5,
  reply_comment:    5,
  improve_headline: 5,
  // viral_rewriter is a sub-tool of generate_post — no separate limit
};

/**
 * Canonical plan values stored in the database.
 * "pro" and "plus" are legacy values — kept for backward compat.
 * New values: linkedin_pro | reddit_pro | bundle | free
 */
export const PAID_PLANS = new Set(["pro", "plus", "linkedin_pro", "reddit_pro", "bundle"]);

/** Plans that unlock unlimited LinkedIn feature usage. */
export const LINKEDIN_UNLIMITED_PLANS = new Set(["pro", "plus", "linkedin_pro", "bundle"]);

/** Plans that unlock unlimited Reddit feature usage. */
export const REDDIT_UNLIMITED_PLANS = new Set(["reddit_pro", "bundle"]);

/** Plans that get the elevated 25-lead cap (vs 5 for free/reddit_pro). */
export const HIGH_LEAD_PLANS = new Set(["pro", "plus", "linkedin_pro", "bundle"]);

export function isLinkedInUnlimited(plan) {
  return LINKEDIN_UNLIMITED_PLANS.has(plan);
}

export function isRedditUnlimited(plan) {
  return REDDIT_UNLIMITED_PLANS.has(plan);
}

export function getFeatureLimitForPlan(feature, plan) {
  if (isLinkedInUnlimited(plan)) return null; // unlimited
  if (!(feature in FEATURE_FREE_LIMITS)) return null;
  return FEATURE_FREE_LIMITS[feature];
}

export function getLeadLimitForPlan(plan) {
  return HIGH_LEAD_PLANS.has(plan) ? LEAD_PRO_LIMIT : LEAD_FREE_LIMIT;
}

export const PLAN_LIMITS = {
  free:         FREE_TIER_LIMIT,
  linkedin_pro: 500,
  reddit_pro:   FREE_TIER_LIMIT, // LinkedIn features stay at free tier
  bundle:       500,
  pro:          500,   // legacy
  plus:         2000,  // legacy
};

export const PLAN_MODELS = {
  free:         "openai/gpt-4o-mini",
  linkedin_pro: "anthropic/claude-sonnet-4",
  reddit_pro:   "openai/gpt-4o-mini",
  bundle:       "anthropic/claude-sonnet-4",
  pro:          "anthropic/claude-sonnet-4",
  plus:         "anthropic/claude-sonnet-4",
};

export function getModelForPlan(plan) {
  return PLAN_MODELS[plan] ?? PLAN_MODELS.free;
}

export function getLimitForPlan(plan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function normalizePlan(plan) {
  if (PAID_PLANS.has(plan)) return plan;
  return "free";
}
