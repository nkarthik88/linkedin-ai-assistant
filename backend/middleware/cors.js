import cors from "cors";

const chromeExtensionOrigin = /^chrome-extension:\/\/.+$/;

// Explicit allowlist of Vercel preview URLs for this project only
const ALLOWED_VERCEL_PREFIXES = [
  "https://linkedin-ai-landing",
  "https://linkedin-ai-backend",
  "https://propostly",
];

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (
      chromeExtensionOrigin.test(origin) ||
      origin === "http://localhost:3000" ||
      origin.startsWith("http://127.0.0.1:") ||
      origin === "https://propostly.com" ||
      origin === "https://www.propostly.com" ||
      ALLOWED_VERCEL_PREFIXES.some((p) => origin.startsWith(p) && origin.endsWith(".vercel.app"))
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
});
