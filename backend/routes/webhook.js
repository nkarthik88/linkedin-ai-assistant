import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  verifyDodoWebhook,
  extractPlanFromWebhookEvent,
  extractUserIdFromWebhookEvent,
} from "../services/dodo.js";
import { setProStatusForUser } from "../services/usage.js";
import { sendPaymentReceiptEmail } from "../services/email.js";
import { supabaseAdmin } from "../services/supabase.js";

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
      const isPro = plan !== "free";
      await setProStatusForUser(userId, isPro);

      // Send receipt email on upgrade (fire-and-forget)
      if (isPro) {
        const data = event.data || event;
        const email =
          data.customer?.email ||
          data.metadata?.email ||
          data.billing_details?.email ||
          null;

        if (email) {
          // Store email so cancel flow can use it
          try {
            await supabaseAdmin
              .from("extension_accounts")
              .upsert({ id: userId, email }, { onConflict: "id" });
          } catch { /* non-fatal */ }

          sendPaymentReceiptEmail(email, { userId }).catch(() => {});
        }
      }
    }

    res.json({ received: true, userId: userId || null, plan: plan || null });
  })
);

export default router;
