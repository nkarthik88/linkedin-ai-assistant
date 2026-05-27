import cors from "cors";

const chromeExtensionOrigin = /^chrome-extension:\/\/.+$/;

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (
      chromeExtensionOrigin.test(origin) ||
      origin === "http://localhost:3000" ||
      origin.startsWith("http://127.0.0.1:") ||
      origin === "https://linkedin-ai-backend-rho.vercel.app" ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
});
