import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  verifyDodoWebhook,
  extractPlanFromWebhookEvent,
  extractUserIdFromWebhookEvent,
  extractSubscriptionIdFromWebhookEvent,
} from "../services/dodo.js";
import { setProStatusForUser, logFunnelEvent } from "../services/usage.js";
import { sendPaymentReceiptEmail } from "../services/email.js";
import { supabaseAdmin } from "../services/supabase.js";
import { config } from "../config.js";

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

    const data = event.data || event;
    let userId = extractUserIdFromWebhookEvent(event);
    const plan = extractPlanFromWebhookEvent(event);
    const subscriptionId = extractSubscriptionIdFromWebhookEvent(event);

    // Fallback: Dodo does not re-send metadata on cancellation events — look up
    // the user by their stored subscription_id when metadata is missing.
    if (!userId && subscriptionId) {
      const { data: acctBySubId } = await supabaseAdmin
        .from("extension_accounts")
        .select("id")
        .eq("subscription_id", subscriptionId)
        .maybeSingle();
      if (acctBySubId) userId = acctBySubId.id;
    }

    // Detect cancellation via event type OR data.status field
    const eventType = String(event.type || event.event_type || "").toLowerCase();
    const dataStatus = String(data.status || data.subscription?.status || "").toLowerCase();
    const isCancellation =
      eventType.includes("cancel") ||
      eventType.includes("expired") ||
      dataStatus === "cancelled" ||
      dataStatus === "expired";

    if (userId && isCancellation) {
      await setProStatusForUser(userId, false);
      return res.json({ received: true, userId, plan: "free", action: "cancelled" });
    }

    // Handle Bundle upgrade one-time payment (upgrade_to=bundle metadata)
    const upgradeTo = data.metadata?.upgrade_to;
    const upgradeFrom = data.metadata?.upgrade_from;
    if (userId && upgradeTo === "bundle") {
      // Set plan to bundle in Supabase
      await supabaseAdmin
        .from("extension_accounts")
        .upsert({ id: userId, plan: "bundle", is_pro: true }, { onConflict: "id" });

      // Cancel old subscription (linkedin_pro or reddit_pro) via Dodo API
      if (config.dodoSecretKey || config.dodoApiKey) {
        const apiKey = (config.dodoSecretKey || config.dodoApiKey).trim();
        const apiBase = (process.env.DODO_API_BASE || "https://live.dodopayments.com").replace(/\/+$/, "");
        try {
          const { data: acct } = await supabaseAdmin
            .from("extension_accounts")
            .select("subscription_id")
            .eq("id", userId)
            .maybeSingle();
          const oldSubId = acct?.subscription_id;
          if (oldSubId) {
            await fetch(`${apiBase}/subscriptions/${oldSubId}`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ status: "cancelled" }),
            });
          }
        } catch { /* non-fatal */ }
      }

      // Send receipt email
      const email = data.customer?.email || data.metadata?.email || null;
      if (email) {
        try {
          await supabaseAdmin.from("extension_accounts").upsert({ id: userId, email }, { onConflict: "id" });
        } catch { /* non-fatal */ }
        sendPaymentReceiptEmail(email, { userId }).catch(() => {});
      }

      logFunnelEvent({ userId, event: "payment_completed", plan: "bundle" }).catch(() => {});
      return res.json({ received: true, userId, plan: "bundle", upgrade: true });
    }

    if (userId && plan) {
      const isPro = plan !== "free";
      await setProStatusForUser(userId, isPro);

      // Store subscription_id and plan for future upgrades
      if (isPro && subscriptionId) {
        try {
          await supabaseAdmin
            .from("extension_accounts")
            .upsert({ id: userId, subscription_id: subscriptionId, plan }, { onConflict: "id" });
        } catch { /* non-fatal */ }
      }

      // Send receipt email on upgrade (fire-and-forget)
      if (isPro) {
        const email =
          data.customer?.email ||
          data.metadata?.email ||
          data.billing_details?.email ||
          null;

        if (email) {
          try {
            await supabaseAdmin
              .from("extension_accounts")
              .upsert({ id: userId, email }, { onConflict: "id" });
          } catch { /* non-fatal */ }

          sendPaymentReceiptEmail(email, { userId }).catch(() => {});
        }
        logFunnelEvent({ userId, event: "payment_completed", plan }).catch(() => {});
      }
    }

    res.json({ received: true, userId: userId || null, plan: plan || null });
  })
);

export default router;
