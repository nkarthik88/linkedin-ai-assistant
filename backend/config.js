import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local .env files only in development (Vercel injects env at runtime).
if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, ".env") });
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  dodoApiKey: process.env.DODO_API_KEY || process.env.DODO_SECRET_KEY || "",
  dodoPublicKey: process.env.DODO_PUBLIC_KEY || "",
  dodoSecretKey: process.env.DODO_SECRET_KEY || process.env.DODO_API_KEY || "",
  dodoProductId: (process.env.DODO_PRODUCT_ID || "").trim(),
  dodoWebhookSecret: process.env.DODO_WEBHOOK_SECRET || "",
  backendUrl: process.env.BACKEND_URL || "https://www.propostly.com",
  resendApiKey: process.env.RESEND_API_KEY || "",
  fromEmail: process.env.FROM_EMAIL || "support@propostly.com",
  // Owner/developer accounts get unlimited usage (no quota enforcement).
  ownerEmails: (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};
