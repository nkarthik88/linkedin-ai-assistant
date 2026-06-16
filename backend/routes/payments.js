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

// Generate $10 Bundle Upgrade checkout for existing LinkedIn Pro / Reddit Pro subscribers
router.post(
  "/upgrade-plan",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const newPlan = req.body?.newPlan;
    const customerEmail = String(req.body?.email || "").trim();

    if (!userId || newPlan !== "bundle") {
      return res.status(400).json({ error: "Missing userId or invalid newPlan (only bundle supported)" });
    }

    // Verify user actually has an eligible plan (linkedin_pro or reddit_pro)
    const { data: acct } = await supabaseAdmin
      .from("extension_accounts")
      .select("subscription_id, plan, email")
      .eq("id", userId)
      .maybeSingle();

    const currentPlan = acct?.plan || "free";
    const eligiblePlans = new Set(["linkedin_pro", "reddit_pro", "pro", "plus"]);
    if (!eligiblePlans.has(currentPlan)) {
      return res.status(400).json({ error: "not_eligible", message: "No eligible plan for upgrade. Use standard Bundle checkout." });
    }

    const email = customerEmail || acct?.email || "";
    const upgradeProductId = config.dodoProductIdBundleUpgrade;
    if (!upgradeProductId) {
      return res.status(500).json({ error: "Bundle upgrade product not configured" });
    }

    // Build $10 one-time checkout URL for the upgrade
    const locale = req.body?.india ? "IN" : undefined;
    const params = new URLSearchParams({ quantity: "1" });
    if (email) params.set("email", email);
    if (userId) params.set("metadata[user_id]", userId);
    params.set("metadata[userId]", userId);
    params.set("metadata[upgrade_from]", currentPlan);
    params.set("metadata[upgrade_to]", "bundle");
    params.set("client_reference_id", userId);
    if (locale) params.set("country", locale);

    const checkoutUrl = `https://checkout.dodopayments.com/buy/${upgradeProductId}?${params.toString()}`;
    return res.json({ checkoutUrl, method: "upgrade_checkout" });
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
    // Fail-secure: if an email is on file, the caller MUST provide a matching one.
    const callerEmail = String(req.body?.email || "").trim().toLowerCase();
    const { data: acct } = await supabaseAdmin
      .from("extension_accounts")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const onFile = (acct?.email || "").trim().toLowerCase();
    if (onFile && (!callerEmail || onFile !== callerEmail)) {
      return res.status(403).json({ error: "Email is required to cancel a subscription" });
    }

    // Use the email already fetched above for the receipt
    let email = callerEmail || onFile || "";

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
