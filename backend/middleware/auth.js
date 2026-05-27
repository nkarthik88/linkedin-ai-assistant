import { createUserClient } from "../services/supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.slice(7);
    const supabase = createUserClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
