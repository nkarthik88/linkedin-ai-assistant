import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createUpgradeCheckoutUrl } from "../services/dodoCheckout.js";

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

export default router;
