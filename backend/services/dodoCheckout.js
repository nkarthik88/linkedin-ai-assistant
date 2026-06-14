import { config } from "../config.js";

const DEFAULT_RETURN_URL = "https://www.propostly.com";

function getDodoApiBase() {
  const override = (process.env.DODO_API_BASE || "").trim();
  if (override) return override.replace(/\/+$/, "");

  const secret = (config.dodoSecretKey || config.dodoApiKey || "").toLowerCase();
  if (secret.startsWith("sk_test") || secret.includes("_test_")) {
    return "https://test.dodopayments.com";
  }
  return "https://live.dodopayments.com";
}

function getReturnUrl() {
  const fromEnv = (config.backendUrl || "").trim();
  return (fromEnv || DEFAULT_RETURN_URL).replace(/\/+$/, "");
}

function getProductIdForPlan(plan) {
  if (plan === "reddit_pro") return (config.dodoProductIdReddit || "").trim();
  if (plan === "bundle")     return (config.dodoProductIdBundle  || "").trim();
  return (config.dodoProductIdLinkedIn || config.dodoProductId || "").trim();
}

function resolveCustomerEmail(userId, customerEmail) {
  const email = (customerEmail || "").trim();
  if (email && email.includes("@")) return email;
  // Valid placeholder so Dodo checkout always has a customer email
  return `upgrade+${String(userId).slice(0, 8)}@propostly.com`;
}

function isIndiaCheckout(options = {}) {
  const country = String(options.country || options.billingCountry || "")
    .trim()
    .toUpperCase();
  if (country === "IN") return true;
  return Boolean(options.india);
}

function defaultBillingAddress(options = {}) {
  if (isIndiaCheckout(options)) {
    return {
      street: "100 MG Road",
      city: "Mumbai",
      state: "MH",
      country: "IN",
      zipcode: "400001",
    };
  }
  return {
    street: "100 Main St",
    city: "San Francisco",
    state: "CA",
    country: "US",
    zipcode: "94105",
  };
}

const INDIA_PAYMENT_METHOD_TYPES = ["upi_collect", "credit", "debit"];

function buildMetadata(userId) {
  return {
    user_id: userId,
    userId,
    reference_id: userId,
    // Payment connector reference (fixes "missing required param: connector_response_reference_id")
    connector_response_reference_id: userId,
  };
}

/**
 * Static checkout URL — most reliable for Chrome extension redirects.
 * @see https://docs.dodopayments.com/developer-resources/integration-guide
 */
export function buildStaticCheckoutUrl({
  userId,
  customerEmail,
  customerName,
  country,
  india,
  plan = "linkedin_pro",
}) {
  const productId = getProductIdForPlan(plan);
  if (!productId) {
    throw new Error("DODO_PRODUCT_ID is not configured");
  }

  const returnUrl = getReturnUrl();
  const email = resolveCustomerEmail(userId, customerEmail);
  const billing = defaultBillingAddress({ country, india });
  const indiaCheckout = isIndiaCheckout({ country, india });

  const url = new URL(`https://checkout.dodopayments.com/buy/${productId}`);
  url.searchParams.set("quantity", "1");
  url.searchParams.set("return_url", returnUrl);
  // Some Dodo checkout builds also accept redirect_url
  url.searchParams.set("redirect_url", returnUrl);

  url.searchParams.set("email", email);
  url.searchParams.set("fullName", customerName || "");
  url.searchParams.set("country", billing.country);
  url.searchParams.set("addressLine", billing.street);
  url.searchParams.set("city", billing.city);
  url.searchParams.set("state", billing.state);
  url.searchParams.set("zipCode", billing.zipcode);

  if (indiaCheckout) {
    url.searchParams.set("billing_currency", "INR");
    url.searchParams.set("payment_method", "upi");
    url.searchParams.set("allowed_payment_method_types", "upi_collect");
  }

  url.searchParams.set("metadata_user_id", userId);
  url.searchParams.set("metadata_reference_id", userId);
  url.searchParams.set("metadata_connector_response_reference_id", userId);

  return url.toString();
}

async function dodoApiRequest(path, body) {
  const apiKey = (config.dodoSecretKey || config.dodoApiKey || "").trim();
  if (!apiKey) {
    const err = new Error("Dodo API key is not configured");
    err.statusCode = 500;
    throw err;
  }

  const response = await fetch(`${getDodoApiBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.errors) ? data.errors[0]?.message : null) ||
      `Dodo API failed (${response.status})`;
    const err = new Error(message);
    err.statusCode =
      response.status >= 400 && response.status < 600 ? response.status : 502;
    throw err;
  }

  return data;
}

/**
 * Checkout Sessions API (fallback) with all recommended fields.
 */
export async function createDodoCheckoutSession({
  userId,
  customerEmail,
  customerName,
  country,
  india,
  plan = "linkedin_pro",
}) {
  const productId = getProductIdForPlan(plan);
  if (!productId) {
    const err = new Error("DODO_PRODUCT_ID is not configured");
    err.statusCode = 500;
    throw err;
  }

  const email = resolveCustomerEmail(userId, customerEmail);
  const billing = defaultBillingAddress({ country, india });
  const indiaCheckout = isIndiaCheckout({ country, india });

  const body = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: getReturnUrl(),
    confirm: false,
    customer: {
      email,
      name: customerName || undefined,
    },
    metadata: buildMetadata(userId),
  };

  if (indiaCheckout) {
    body.billing_currency = "INR";
    body.allowed_payment_method_types = INDIA_PAYMENT_METHOD_TYPES;
  }

  const data = await dodoApiRequest("/checkouts", body);

  const checkoutUrl = data.checkout_url || data.checkoutUrl;
  if (!checkoutUrl) {
    const err = new Error("Dodo did not return a checkout URL");
    err.statusCode = 502;
    throw err;
  }

  return checkoutUrl;
}

/**
 * Dynamic payment link API (second fallback).
 */
export async function createDodoPaymentLink({
  userId,
  customerEmail,
  customerName,
  country,
  india,
  plan = "linkedin_pro",
}) {
  const productId = getProductIdForPlan(plan);
  if (!productId) {
    throw new Error("DODO_PRODUCT_ID is not configured");
  }

  const email = resolveCustomerEmail(userId, customerEmail);
  const billing = defaultBillingAddress({ country, india });
  const indiaCheckout = isIndiaCheckout({ country, india });

  const body = {
    payment_link: true,
    return_url: getReturnUrl(),
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: {
      email,
      name: customerName || "ProPostly User",
    },
    billing,
    metadata: buildMetadata(userId),
  };

  if (indiaCheckout) {
    body.billing_currency = "INR";
    body.allowed_payment_method_types = INDIA_PAYMENT_METHOD_TYPES;
  }

  const data = await dodoApiRequest("/payments", body);

  const checkoutUrl = data.payment_link || data.checkout_url || data.checkoutUrl;
  if (!checkoutUrl) {
    throw new Error("Dodo did not return a payment link");
  }

  return checkoutUrl;
}

/**
 * Preferred order: checkout session API → payment link → static URL fallback.
 * Static URL is last because it pre-fills billing address as locked fields,
 * which prevents users from editing the form (mouse clicks appear blocked).
 */
export async function createUpgradeCheckoutUrl({
  userId,
  customerEmail,
  customerName,
  country,
  india,
  plan = "linkedin_pro",
}) {
  const checkoutOpts = { userId, customerEmail, customerName, country, india, plan };
  const indiaCheckout = isIndiaCheckout({ country, india });

  // Checkout Session API — proper interactive hosted page, all fields editable
  if (config.dodoSecretKey || config.dodoApiKey) {
    try {
      return {
        checkoutUrl: await createDodoCheckoutSession(checkoutOpts),
        method: indiaCheckout ? "session_india" : "session",
      };
    } catch {
      // fall through to payment link
    }

    try {
      return {
        checkoutUrl: await createDodoPaymentLink(checkoutOpts),
        method: "payment_link",
      };
    } catch {
      // fall through to static URL
    }
  }

  // Last resort: static URL (fields may be pre-filled but still functional)
  return {
    checkoutUrl: buildStaticCheckoutUrl(checkoutOpts),
    method: "static",
  };
}
