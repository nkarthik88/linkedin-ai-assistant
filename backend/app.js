import express from "express";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import generateRouter from "./routes/generate.js";
import authRouter from "./routes/auth.js";
import usageRouter from "./routes/usage.js";
import paymentsRouter from "./routes/payments.js";
import webhookRouter from "./routes/webhook.js";
import waitlistRouter from "./routes/waitlist.js";

const app = express();

app.use(corsMiddleware);

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

app.use("/api/generate", generateRouter);
app.use("/api/auth", authRouter);
app.use("/api/usage", usageRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/waitlist", waitlistRouter);

app.use(errorHandler);

export default app;
