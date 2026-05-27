import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { supabaseAdmin } from "../services/supabase.js";
import { sendWelcomeEmail } from "../services/email.js";

const router = Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@") || !email.includes(".")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (email.length > 254) {
      return res.status(400).json({ error: "Email address too long." });
    }

    // Upsert so duplicate signups don't error
    const { error } = await supabaseAdmin
      .from("waitlist_emails")
      .upsert({ email, signed_up_at: new Date().toISOString() }, { onConflict: "email", ignoreDuplicates: true });

    if (error && !error.message?.includes("duplicate")) {
      throw error;
    }

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(email).catch(() => {});

    res.json({ success: true });
  })
);

export default router;
