const ALLOWED_ORIGIN_PATTERNS = [
  /^chrome-extension:\/\/.+$/,
  /^https:\/\/linkedin-ai-backend-rho\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function setVercelCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const allowed =
    !origin || ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}
