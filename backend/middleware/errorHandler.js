export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  const message =
    status >= 500 ? "Internal server error" : err.message || "Request failed";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
