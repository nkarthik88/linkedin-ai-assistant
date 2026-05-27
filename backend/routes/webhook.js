import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  verifyDodoWebhook,
  extractPlanFromWebhookEvent,
  extractUserIdFromWebhookEvent,
} from "../services/dodo.js";
import { setProStatusForUser } from "../services/usage.js";

const router = Router();

router.post(
  "/dodo",
  asyncHandler(async (req, res) => {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: "Missing raw request body" });
    }

    const event = verifyDodoWebhook(rawBody, {
      "webhook-id": req.headers["webhook-id"],
      "webhook-signature": req.headers["webhook-signature"],
      "webhook-timestamp": req.headers["webhook-timestamp"],
    });

    const userId = extractUserIdFromWebhookEvent(event);
    const plan = extractPlanFromWebhookEvent(event);

    if (userId && plan) {
      // Persist payment entitlement via `users.is_pro` (not `users.plan`).
      const isPro = plan !== "free";
      await setProStatusForUser(userId, isPro);
    }

    res.json({ received: true, userId: userId || null, plan: plan || null });
  })
);

export default router;
