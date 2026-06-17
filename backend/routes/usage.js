import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { FREE_TIER_LIMIT, LEAD_FREE_LIMIT, FEATURE_FREE_LIMITS } from "../constants/plans.js";
import { getUsageSummary, getAccountStatus, logFunnelEvent } from "../services/usage.js";

const router = Router();

function fallbackStatus() {
  const feature_usage = {};
  for (const [f, limit] of Object.entries(FEATURE_FREE_LIMITS)) {
    feature_usage[f] = { used: 0, limit, remaining: limit, unlimited: false };
  }
  return {
    isPro: false,
    plan: "free",
    tier: "free",
    tierLabel: "Free Tier",
    usedThisMonth: 0,
    limit: FREE_TIER_LIMIT,
    remaining: FREE_TIER_LIMIT,
    unlimited: false,
    lead_searches_used: 0,
    lead_searches_limit: LEAD_FREE_LIMIT,
    lead_searches_remaining: LEAD_FREE_LIMIT,
    feature_usage,
    message: `${FREE_TIER_LIMIT} uses remaining this month`,
  };
}

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId query parameter is required" });
    }
    try {
      const status = await getAccountStatus(userId);
      const message = status.isPro
        ? "Unlimited uses"
        : `${status.remaining} uses remaining this month`;
      res.json({ ...status, message });
    } catch (err) {
      // notRegistered means onboarding hasn't been completed — return fallback
      // silently so the popup loads without error. No row is created.
      if (err.notRegistered) {
        return res.json({ ...fallbackStatus(), notRegistered: true });
      }
      res.json(fallbackStatus());
    }
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await getUsageSummary(req.user.id);
    res.json(summary);
  })
);

// Funnel event from extension (upgrade_initiated etc.)
router.post(
  "/funnel",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const event  = String(req.body?.event  || "").trim();
    const plan   = String(req.body?.plan   || "").trim() || null;
    if (!userId || !event) return res.status(400).json({ error: "userId and event required" });
    logFunnelEvent({ userId, event, plan }).catch(() => {});
    res.json({ ok: true });
  })
);

export default router;
