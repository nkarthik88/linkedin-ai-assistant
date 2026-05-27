import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createUpgradeCheckoutUrl } from "../services/dodoCheckout.js";
import { setProStatusForUser } from "../services/usage.js";
import { sendCancellationEmail } from "../services/email.js";
import { config } from "../config.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = Router();

router.post(
  "/upgrade",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || req.body?.user_id || "").trim();
    const customerEmail = String(
      req.body?.email || req.body?.customerEmail || ""
    ).trim();
    const customerName = String(req.body?.name || req.body?.customerName || "").trim();
    const country = String(req.body?.country || req.body?.billingCountry || "")
      .trim()
      .toUpperCase();
    const india =
      country === "IN" ||
      req.body?.india === true ||
      String(req.body?.india || "").toLowerCase() === "true";

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    // Store email for later use (receipt, cancellation) — non-fatal
    if (customerEmail && customerEmail.includes("@")) {
      try {
        await supabaseAdmin
          .from("extension_accounts")
          .upsert({ id: userId, email: customerEmail }, { onConflict: "id" });
      } catch {
        /* non-fatal */
      }
    }

    const { checkoutUrl, method } = await createUpgradeCheckoutUrl({
      userId,
      customerEmail: customerEmail || undefined,
      customerName: customerName || undefined,
      country: country || undefined,
      india,
    });

    res.json({ checkoutUrl, method });
  })
);

router.post(
  "/cancel",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    // Get email before downgrading
    let email = String(req.body?.email || "").trim();

    if (!email) {
      try {
        const { data } = await supabaseAdmin
          .from("extension_accounts")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        email = data?.email || "";
      } catch {
        /* non-fatal */
      }
    }

    // Cancel via Dodo API — find subscription by customer metadata
    if (config.dodoSecretKey || config.dodoApiKey) {
      const apiKey = (config.dodoSecretKey || config.dodoApiKey).trim();
      const apiBase = (process.env.DODO_API_BASE || "https://live.dodopayments.com").replace(/\/+$/, "");

      try {
        const subsRes = await fetch(`${apiBase}/subscriptions?limit=10`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (subsRes.ok) {
          const subsData = await subsRes.json();
          const items = subsData.items || subsData.data || [];
          const sub = items.find(
            (s) =>
              s.metadata?.user_id === userId ||
              s.metadata?.userId === userId ||
              s.client_reference_id === userId
          );
          if (sub) {
            const subId = sub.subscription_id || sub.id;
            await fetch(`${apiBase}/subscriptions/${subId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "cancelled" }),
            });
          }
        }
      } catch {
        /* Non-fatal — still downgrade locally */
      }
    }

    // Downgrade to free in DB
    await setProStatusForUser(userId, false);

    // Send cancellation email (fire-and-forget)
    if (email && email.includes("@")) {
      sendCancellationEmail(email).catch(() => {});
    }

    res.json({ cancelled: true, message: "Subscription cancelled. You have been moved to the free plan." });
  })
);

export default router;
