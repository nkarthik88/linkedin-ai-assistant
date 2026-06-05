import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = Router();

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const user = data.user;
    if (!user) {
      return res.status(400).json({ error: "Signup failed" });
    }

    const { error: profileError } = await supabaseAdmin.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        plan: "free",
        usage_this_month: 0,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("Failed to create users profile:", profileError.message);
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
      session: data.session,
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: data.session,
    });
  })
);

// Extension-only registration: store userId + email in extension_accounts.
// If the email already exists (reinstall scenario), returns the canonical userId
// for that email so the reinstalled extension inherits the same account + usage.
router.post(
  "/register-extension",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const email  = String(req.body?.email  || "").trim().toLowerCase();
    const name   = String(req.body?.name   || "").trim();

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRe.test(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if this email already exists in extension_accounts (reinstall case)
    const { data: existing } = await supabaseAdmin
      .from("extension_accounts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Return the canonical userId — extension will overwrite its local UUID
      return res.json({ ok: true, userId: existing.id });
    }

    // Also check users table (paid/auth users who reinstalled)
    const { data: authUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (authUser) {
      return res.json({ ok: true, userId: authUser.id });
    }

    // New user — create account
    const fields = { id: userId, email };
    const { error } = await supabaseAdmin
      .from("extension_accounts")
      .upsert(fields, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Best-effort: save name if column exists
    if (name) {
      await supabaseAdmin
        .from("extension_accounts")
        .update({ name })
        .eq("id", userId)
        .then(() => {}).catch(() => {});
    }

    res.json({ ok: true, userId });
  })
);

export default router;
