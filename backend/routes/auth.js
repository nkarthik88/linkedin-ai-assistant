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
// If only a device_fingerprint is supplied (no email yet), we can still recover
// the account when the user enters their email later.
router.post(
  "/register-extension",
  asyncHandler(async (req, res) => {
    const userId            = String(req.body?.userId            || "").trim();
    const email             = String(req.body?.email             || "").trim().toLowerCase();
    const name              = String(req.body?.name              || "").trim();
    const deviceFingerprint = String(req.body?.deviceFingerprint || "").trim();

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRe.test(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Email is required" });
    }

    // 1. Email match — primary reinstall recovery
    const { data: existingByEmail } = await supabaseAdmin
      .from("extension_accounts")
      .select("id, device_fingerprint")
      .eq("email", email)
      .maybeSingle();

    if (existingByEmail) {
      // Update fingerprint if we now have one and the row doesn't yet
      if (deviceFingerprint && !existingByEmail.device_fingerprint) {
        await supabaseAdmin
          .from("extension_accounts")
          .update({ device_fingerprint: deviceFingerprint })
          .eq("id", existingByEmail.id)
          .then(() => {}).catch(() => {});
      }
      return res.json({ ok: true, userId: existingByEmail.id });
    }

    // 2. Fingerprint match — secondary reinstall recovery (new email entered after reinstall)
    if (deviceFingerprint) {
      const { data: existingByFp } = await supabaseAdmin
        .from("extension_accounts")
        .select("id")
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (existingByFp) {
        // Same device, possibly updated email — update email and return canonical account
        await supabaseAdmin
          .from("extension_accounts")
          .update({ email })
          .eq("id", existingByFp.id)
          .then(() => {}).catch(() => {});
        return res.json({ ok: true, userId: existingByFp.id });
      }
    }

    // 3. Check users table (paid/auth users who reinstalled)
    const { data: authUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (authUser) {
      return res.json({ ok: true, userId: authUser.id });
    }

    // 4. New user — create account
    const fields = {
      id: userId,
      email,
      ...(deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}),
    };
    const { error } = await supabaseAdmin
      .from("extension_accounts")
      .upsert(fields, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

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

// Link a LinkedIn profile ID to an account — and detect if this LinkedIn ID
// already belongs to a different account (reinstall + new email bypass).
router.post(
  "/link-linkedin",
  asyncHandler(async (req, res) => {
    const userId     = String(req.body?.userId     || "").trim();
    const linkedinId = String(req.body?.linkedinId || "").trim().toLowerCase();

    if (!userId || !linkedinId) {
      return res.status(400).json({ error: "userId and linkedinId required" });
    }

    // Check extension_accounts for this LinkedIn ID on a DIFFERENT account
    const { data: existingExt } = await supabaseAdmin
      .from("extension_accounts")
      .select("id")
      .eq("linkedin_id", linkedinId)
      .neq("id", userId)
      .maybeSingle();

    if (existingExt) {
      // Same LinkedIn user, different local UUID — return canonical account
      return res.json({ ok: true, canonicalUserId: existingExt.id });
    }

    // Check users table too
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("linkedin_id", linkedinId)
      .neq("id", userId)
      .maybeSingle();

    if (existingUser) {
      return res.json({ ok: true, canonicalUserId: existingUser.id });
    }

    // No conflict — store LinkedIn ID on this account (best-effort, column may not exist yet)
    await supabaseAdmin
      .from("extension_accounts")
      .update({ linkedin_id: linkedinId })
      .eq("id", userId)
      .then(() => {}).catch(() => {});

    res.json({ ok: true, canonicalUserId: userId });
  })
);

export default router;
