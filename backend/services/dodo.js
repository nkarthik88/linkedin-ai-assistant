import crypto from "crypto";
import { config } from "../config.js";

const REPLAY_TOLERANCE_SEC = 5 * 60;

/**
 * Standard Webhooks secrets are formatted `whsec_<base64>`. The HMAC key is the
 * base64-decoded bytes after the prefix — not the raw string.
 */
function getSigningKey(secret) {
  const withoutPrefix = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(withoutPrefix, "base64");
}

function parseSignatureHeader(header) {
  if (!header) return null;
  const parts = String(header).split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith("v1=")) return trimmed.slice(3);
    if (!trimmed.includes("=") && trimmed.length > 10) return trimmed;
  }
  return parts[parts.length - 1]?.trim() || null;
}

/**
 * Verify Dodo / Standard Webhooks signature.
 * Signed message: webhook-id.webhook-timestamp.rawBody
 */
export function verifyDodoWebhook(rawBody, headers) {
  if (!config.dodoWebhookSecret) {
    const err = new Error("DODO_WEBHOOK_SECRET is not configured");
    err.statusCode = 500;
    throw err;
  }

  const webhookId = headers["webhook-id"];
  const webhookTimestamp = headers["webhook-timestamp"];
  const webhookSignature = headers["webhook-signature"];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    const err = new Error("Missing webhook verification headers");
    err.statusCode = 401;
    throw err;
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) {
    const err = new Error("Invalid webhook timestamp");
    err.statusCode = 401;
    throw err;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > REPLAY_TOLERANCE_SEC) {
    const err = new Error("Webhook timestamp outside tolerance");
    err.statusCode = 401;
    throw err;
  }

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", getSigningKey(config.dodoWebhookSecret))
    .update(signedPayload)
    .digest("base64");

  const provided = parseSignatureHeader(webhookSignature);
  if (!provided) {
    const err = new Error("Invalid webhook-signature header");
    err.statusCode = 401;
    throw err;
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    const err = new Error("Webhook signature verification failed");
    err.statusCode = 401;
    throw err;
  }

  return JSON.parse(rawBody);
}

export function extractPlanFromWebhookEvent(event) {
  const type = event.type || event.event_type || "";
  const data = event.data || event;

  if (type.includes("cancel") || type.includes("expired")) {
    return "free";
  }

  if (
    type.includes("active") ||
    type.includes("renewed") ||
    type.includes("succeeded") ||
    type.includes("created")
  ) {
    const productId =
      data.product_id ||
      data.plan_id ||
      data.metadata?.plan ||
      data.subscription?.product_id;

    // Map exact product IDs to plan strings
    const PRODUCT_PLAN_MAP = {
      "pdt_0nfglmamcuzd4givlnt0h": "linkedin_pro",
      "pdt_0nh1zryt8ch4kti9b5yvj": "reddit_pro",
      "pdt_0nh23ajmtvbuwaxksi2ds": "bundle",
    };
    const productStr = String(productId || "").toLowerCase().replace(/\?.*$/, "");
    if (PRODUCT_PLAN_MAP[productStr]) return PRODUCT_PLAN_MAP[productStr];
    // Fallback: keyword matching
    if (productStr.includes("bundle")) return "bundle";
    if (productStr.includes("reddit")) return "reddit_pro";
    return "linkedin_pro";
  }

  return null;
}

export function extractUserIdFromWebhookEvent(event) {
  const data = event.data || event;
  return (
    data.metadata?.user_id ||
    data.metadata?.userId ||
    data.metadata?.connector_response_reference_id ||
    data.metadata?.reference_id ||
    data.customer?.metadata?.user_id ||
    data.customer?.metadata?.userId ||
    data.client_reference_id ||
    data.reference_id ||
    null
  );
}
