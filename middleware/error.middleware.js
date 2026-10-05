import { normalizeError } from "../utils/apiError.js";

// =========================
// Central error handler. Turns anything thrown in a controller into the
// project's response envelope: { success: false, message }
// =========================
export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const { status, message } = normalizeError(err);

  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} ->`, err);
  }

  return res.status(status).json({
    success: false,
    message,
  });
};

export default errorHandler;
