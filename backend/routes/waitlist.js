import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { supabaseAdmin } from "../services/supabase.js";
import { sendWelcomeEmail } from "../services/email.js";

const router = Router();

// POST /api/waitlist — add email to waitlist
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

    let alreadyExists = false;

    try {
      const { error } = await supabaseAdmin
        .from("waitlist_emails")
        .upsert(
          { email, signed_up_at: new Date().toISOString(), source: "landing_page" },
          { onConflict: "email", ignoreDuplicates: true }
        );
      if (error && !error.message?.includes("duplicate")) throw error;
    } catch (err) {
      // Check if it was a duplicate (already signed up)
      if (err?.message?.includes("duplicate") || err?.code === "23505") {
        alreadyExists = true;
      } else {
        console.error("[waitlist] Supabase error:", err);
        throw err;
      }
    }

    // Always await email so Vercel doesn't kill the function before it sends
    try {
      await sendWelcomeEmail(email);
      console.log(`[waitlist] Welcome email sent to ${email}`);
    } catch (emailErr) {
      console.error(`[waitlist] Email send failed for ${email}:`, emailErr?.message || emailErr);
      // Don't fail the request — just log. User is still on the list.
    }

    res.json({ success: true, message: "You're on the list! Check your inbox for a welcome email." });
  })
);

// GET /api/waitlist/count — total signups
router.get(
  "/count",
  asyncHandler(async (_req, res) => {
    const { count, error } = await supabaseAdmin
      .from("waitlist_emails")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    res.json({ count, message: `${count} people on the waitlist` });
  })
);

// GET /api/waitlist/all — all emails (for admin use)
router.get(
  "/all",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("waitlist_emails")
      .select("email, signed_up_at, source")
      .order("signed_up_at", { ascending: false });

    if (error) throw error;
    res.json({ count: data.length, emails: data });
  })
);

export default router;
