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
// Called after onboarding so emails are in DB from day 1 (no password required).
router.post(
  "/register-extension",
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId || "").trim();
    const email  = String(req.body?.email  || "").trim();
    const name   = String(req.body?.name   || "").trim();

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRe.test(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const fields = { id: userId };
    if (email && email.includes("@")) fields.email = email;
    if (name) fields.name = name;

    const { error } = await supabaseAdmin
      .from("extension_accounts")
      .upsert(fields, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      // Column 'name' may not exist — retry without it
      if (name && error.message?.includes("name")) {
        const { error: e2 } = await supabaseAdmin
          .from("extension_accounts")
          .upsert({ id: userId, ...(email && email.includes("@") ? { email } : {}) }, { onConflict: "id" });
        if (e2) return res.status(500).json({ error: e2.message });
      } else {
        return res.status(500).json({ error: error.message });
      }
    }

    res.json({ ok: true });
  })
);

export default router;
