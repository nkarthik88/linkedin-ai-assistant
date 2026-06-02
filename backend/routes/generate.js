import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { generateVariations, qualifyLeads } from "../services/openrouter.js";
import {
  consumeFeatureCredit,
  consumeLeadSearch,
  logLeadSearchEvent,
} from "../services/usage.js";
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
    const account = await consumeFeatureCredit(userId, feature);
    const variations = await generateVariations({
      feature,
      data,
      tone,
      plan: account.plan,
    });

    // Fire-and-forget emails (never block the response)
    const email = req.body.email || req.body.customerEmail || account.email || null;
    if (email) {
      const featureUsed = (account.featureUsage?.[feature] ?? 0);
      if (featureUsed === 1 && account.usedThisMonth === 0) {
        sendWelcomeEmail(email).catch(() => {});
      } else if (account.featureRemaining === 2) {
        sendUsageWarningEmail(email, { remaining: 2, limit: account.limit }).catch(() => {});
      }
    }

    res.json({
      variations,
      options: variations,
      remainingCredits: account.remainingCredits,
      featureRemaining: account.featureRemaining,
      featureUsed: account.featureUsed ?? null,
      featureLimit: account.featureLimit ?? null,
      limitReached: account.featureRemaining === 0,
    });
  })
);

router.post(
  "/leads",
  asyncHandler(async (req, res) => {
    const { userId, profiles, targetDescription, filters } = req.body;

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({
        error: "No profiles found. Open a LinkedIn people search results page and try again.",
      });
    }

    // userId is optional: when present we enforce + consume the monthly lead
    // quota; when absent (e.g. smoke test) we process without tracking.
    let plan = "free";
    let leadAccount = null;
    if (userId) {
      leadAccount = await consumeLeadSearch(String(userId));
      plan = leadAccount.plan;
    }

    const leads = await qualifyLeads({ profiles, targetDescription, filters, plan });

    // Fire-and-forget analytics (never blocks the response).
    logLeadSearchEvent({
      userId,
      target: targetDescription,
      profilesCount: profiles.length,
      leadsCount: leads.length,
      hotCount: leads.filter((l) => l.quality === "hot").length,
    });

    res.json({
      leads,
      leadSearchesRemaining: leadAccount ? leadAccount.leadSearchesRemaining : null,
      leadSearchLimit: leadAccount ? leadAccount.leadSearchLimit : null,
      limitReached: leadAccount ? leadAccount.leadSearchesRemaining === 0 : false,
    });
  })
);

export default router;
