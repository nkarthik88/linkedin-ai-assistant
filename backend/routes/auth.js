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

export default router;
