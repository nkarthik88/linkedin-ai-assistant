import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { FREE_TIER_LIMIT, LEAD_FREE_LIMIT } from "../constants/plans.js";
import { getUsageSummary, getAccountStatus } from "../services/usage.js";

const router = Router();

function fallbackStatus() {
  return {
    isPro: false,
    tier: "free",
    tierLabel: "Free Tier",
    usedThisMonth: 0,
    limit: FREE_TIER_LIMIT,
    remaining: FREE_TIER_LIMIT,
    unlimited: false,
    lead_searches_used: 0,
    lead_searches_limit: LEAD_FREE_LIMIT,
    lead_searches_remaining: LEAD_FREE_LIMIT,
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
    } catch {
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

export default router;
