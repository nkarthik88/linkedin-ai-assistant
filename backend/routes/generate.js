import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { generateVariations, qualifyLeads } from "../services/openrouter.js";
import {
  consumeFeatureCredit,
  consumeLeadSearch,
  logLeadSearchEvent,
  logFunnelEvent,
  resolveAccount,
} from "../services/usage.js";
import { sendWelcomeEmail, sendUsageWarningEmail } from "../services/email.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const { feature, tone } = req.body;
    const userId = String(req.body?.userId || "").trim();

    if (!userId || !UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }
    if (!feature || typeof feature !== "string") {
      return res.status(400).json({ error: "feature is required" });
    }

    const data = buildDataPayload(req.body);

    // Resolve plan without consuming credit — credit only charges after AI succeeds
    const preAccount = await resolveAccount(userId);
    const variations = await generateVariations({
      feature,
      data,
      tone,
      plan: preAccount.plan,
    });

    if (!variations || variations.length === 0) {
      return res.status(502).json({ error: "AI returned no variations — please try again" });
    }

    // Credit consumed only after real AI results confirmed
    const account = await consumeFeatureCredit(userId, feature);

    // Fire-and-forget funnel tracking
    logFunnelEvent({ userId, event: "feature_used", feature, plan: account.plan, meta: { remaining: account.featureRemaining } }).catch(() => {});
    if (account.featureRemaining === 0) {
      logFunnelEvent({ userId, event: "limit_hit", feature, plan: account.plan }).catch(() => {});
    }

    // Fire-and-forget emails (never block the response)
    const email = req.body.email || req.body.customerEmail || account.email || null;
    if (email) {
      const featureUsed = (account.featureUsage?.[feature] ?? 0);
      if (featureUsed === 1 && account.usedThisMonth === 0) {
        sendWelcomeEmail(email).catch(() => {});
      } else if (account.plan === "free" && account.featureRemaining === 2) {
        sendUsageWarningEmail(email, { remaining: 2, limit: account.featureLimit ?? 10, feature }).catch(() => {});
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
    const { profiles, targetDescription, filters } = req.body;
    const userId = String(req.body?.userId || "").trim();

    if (!userId || !UUID_RE.test(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({
        error: "No profiles found. Open a LinkedIn people search results page and try again.",
      });
    }

    // Resolve plan without consuming so AI failure doesn't cost a search
    const preLeadAccount = await resolveAccount(userId);
    const leads = await qualifyLeads({ profiles, targetDescription, filters, plan: preLeadAccount.plan });

    if (!leads || leads.length === 0) {
      return res.status(502).json({ error: "AI returned no results — please try again" });
    }

    // Consume lead search credit only after AI returns results
    const leadAccount = await consumeLeadSearch(userId);

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
      leadSearchesRemaining: leadAccount.leadSearchesRemaining,
      leadSearchLimit: leadAccount.leadSearchLimit,
      limitReached: leadAccount.leadSearchesRemaining === 0,
    });
  })
);

export default router;
