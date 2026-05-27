import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { generateVariations } from "../services/openrouter.js";
import { consumeCredit } from "../services/usage.js";
import { sendWelcomeEmail, sendUsageWarningEmail } from "../services/email.js";

const router = Router();

function buildDataPayload(body) {
  if (body.data && typeof body.data === "object") {
    return body.data;
  }

  const { userId, feature, data, tone, ...rest } = body;
  return rest;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, feature, tone } = req.body;

    if (!userId || !feature) {
      return res.status(400).json({
        error: "userId and feature are required",
      });
    }

    const data = buildDataPayload(req.body);
    const account = await consumeCredit(userId);
    const variations = await generateVariations({
      feature,
      data,
      tone,
      plan: account.plan,
    });

    // Fire-and-forget emails (never block the response)
    const email = req.body.email || req.body.customerEmail || account.email || null;
    if (email) {
      if (account.usedThisMonth === 1) {
        sendWelcomeEmail(email).catch(() => {});
      } else if (account.remainingCredits === 2) {
        sendUsageWarningEmail(email, { remaining: 2, limit: account.limit }).catch(() => {});
      }
    }

    res.json({
      variations,
      options: variations,
      remainingCredits: account.remainingCredits,
      limitReached: account.remainingCredits === 0,
    });
  })
);

export default router;
