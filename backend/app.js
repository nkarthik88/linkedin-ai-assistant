import express from "express";
import { rateLimit } from "express-rate-limit";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import generateRouter from "./routes/generate.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import paymentsRouter from "./routes/payments.js";
import webhookRouter from "./routes/webhook.js";
import waitlistRouter from "./routes/waitlist.js";

const app = express();

app.set("trust proxy", 1); // Required on Vercel to read real IPs for rate limiting
app.use(corsMiddleware);

// Rate limiting — keyed by IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 60,                   // 60 req/min globally per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,                   // 20 generate calls/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please wait a moment." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,                   // 30 auth attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});

app.use(globalLimiter);

app.use(
  "/api/webhook",
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.use(
  "/api/webhooks",
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/generate", generateLimiter, generateRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/usage", usageRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/waitlist", waitlistRouter);

app.use(errorHandler);

export default app;
