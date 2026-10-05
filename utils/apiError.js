import mongoose from "mongoose";

// =========================
// Maps a thrown error onto the right HTTP status so the client stops
// receiving 500s for things that are genuinely the caller's fault.
//
// Before this existed, a bad enum, a malformed :id and a duplicate key all
// surfaced as 500 + a raw Mongoose message.
// =========================

const DUPLICATE_KEY = 11000;

export const badRequest = (message) => Object.assign(new Error(message), {
  status: 400,
  expose: true,
});

export const notFound = (message = "Resource not found") =>
  Object.assign(new Error(message), { status: 404, expose: true });

export const forbidden = (message = "Access denied") =>
  Object.assign(new Error(message), { status: 403, expose: true });

export const conflict = (message) =>
  Object.assign(new Error(message), { status: 409, expose: true });

export const unauthorized = (message = "Unauthorized") =>
  Object.assign(new Error(message), { status: 401, expose: true });

const isObjectId = mongoose.Types.ObjectId.isValid.bind(mongoose.Types.ObjectId);

const OBJECT_ID_CAST = 8;

export const normalizeError = (error) => {
  if (!error) return { status: 500, message: "Something went wrong" };

  // Already shaped by one of the helpers above.
  if (error.status && error.expose) {
    return { status: error.status, message: error.message };
  }

  // Malformed ObjectId in a path/query param -> 404, not 500.
  if (error.name === "CastError" && error.kind === OBJECT_ID_CAST) {
    return { status: 404, message: "Invalid identifier" };
  }

  // Schema validation (enum, required, min...) -> 400.
  if (error.name === "ValidationError") {
    const [first] = Object.values(error.errors ?? {});
    return {
      status: 400,
      message: first?.message ?? "Validation failed",
    };
  }

  // Unique index violation -> 409.
  if (error.code === DUPLICATE_KEY) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "value";
    const labels = {
      email: "Email already exists",
      slug: "That organization URL is already taken",
      name: "A record with that name already exists",
    };
    return { status: 409, message: labels[field] ?? `Duplicate ${field}` };
  }

  return { status: 500, message: error.message ?? "Something went wrong" };
};

// Wraps an async controller so a rejected promise reaches the error
// middleware instead of hanging the request (Express 5 does this itself,
// but keeping the helper means the intent is explicit).
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export { isObjectId };
