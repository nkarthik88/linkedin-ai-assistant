import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { generateVariations } from "../services/openrouter.js";
import { consumeCredit } from "../services/usage.js";

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

    res.json({
      variations,
      options: variations,
      remainingCredits: account.remainingCredits,
    });
  })
);

export default router;
