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
    const VALID_PLANS = new Set(["linkedin_pro", "reddit_pro", "bundle"]);
    const plan = VALID_PLANS.has(req.body?.plan) ? req.body.plan : "linkedin_pro";

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
      plan,
    });

    res.json({ checkoutUrl, method });
  })
);

// Change plan for existing subscribers (e.g. LinkedIn Pro → Bundle, pays only difference)
router.post(
  "/upgrade-plan",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const newPlan = req.body?.newPlan;
    const VALID_PLANS = new Set(["reddit_pro", "bundle", "linkedin_pro"]);
    if (!userId || !VALID_PLANS.has(newPlan)) {
      return res.status(400).json({ error: "Missing userId or invalid newPlan" });
    }

    // Get current subscription_id from DB
    const { data: acct } = await supabaseAdmin
      .from("extension_accounts")
      .select("subscription_id, plan")
      .eq("id", userId)
      .maybeSingle();

    const subscriptionId = acct?.subscription_id;
    if (!subscriptionId) {
      // No subscription on file — fall back to new checkout
      return res.status(404).json({ error: "no_subscription", message: "No active subscription found. Please use the standard checkout." });
    }

    // Map plan to Dodo product ID
    const PLAN_PRODUCT = {
      linkedin_pro: config.dodoProductIdLinkedIn,
      reddit_pro:   config.dodoProductIdReddit,
      bundle:       config.dodoProductIdBundle,
    };
    const newProductId = PLAN_PRODUCT[newPlan];
    if (!newProductId) {
      return res.status(500).json({ error: "Product ID not configured for plan: " + newPlan });
    }

    const apiKey = (config.dodoSecretKey || config.dodoApiKey || "").trim();
    const apiBase = (process.env.DODO_API_BASE || "https://live.dodopayments.com").replace(/\/+$/, "");

    // Call Dodo Change Plan API
    const r = await fetch(`${apiBase}/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: newProductId,
        proration_billing_mode: "difference_immediately",
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(502).json({ error: err.message || "Dodo plan change failed" });
    }

    // Update plan in DB immediately
    await supabaseAdmin
      .from("extension_accounts")
      .update({ plan: newPlan })
      .eq("id", userId);

    res.json({ success: true, newPlan });
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

    // Verify the caller knows the email on file — prevents strangers from
    // cancelling another user's subscription by guessing their UUID.
    const callerEmail = String(req.body?.email || "").trim().toLowerCase();
    if (callerEmail) {
      const { data: acct } = await supabaseAdmin
        .from("extension_accounts")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      const onFile = (acct?.email || "").trim().toLowerCase();
      if (onFile && onFile !== callerEmail) {
        return res.status(403).json({ error: "Email does not match account" });
      }
    }

    // Get email before downgrading
    let email = callerEmail;

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
