import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import {
  createBookingSchema,
  bookingDecisionSchema,
} from "../validations/booking.validation.js";

import {
  createBooking,
  myBookings,
  getManageableBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
  cancelBooking,
  completeBooking,
} from "../controller/booking.controller.js";

const router = Router();

// `my-bookings` and `manageable` must come before `/:id`.
router.get(
  "/my-bookings",
  auth,
  asyncHandler(myBookings)
);

router.get(
  "/manageable",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getManageableBookings)
);

router.post(
  "/",
  auth,
  validation(createBookingSchema),
  asyncHandler(createBooking)
);

router.get(
  "/:id",
  auth,
  asyncHandler(getBookingById)
);

// =========================
// Decisions
// =========================

router.patch(
  "/:id/approve",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(bookingDecisionSchema),
  asyncHandler(approveBooking)
);

router.patch(
  "/:id/reject",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(bookingDecisionSchema),
  asyncHandler(rejectBooking)
);

router.patch(
  "/:id/complete",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(completeBooking)
);

// Any authenticated user may cancel, but the controller only lets the owner
// or a decider through.
router.patch(
  "/:id/cancel",
  auth,
  validation(bookingDecisionSchema),
  asyncHandler(cancelBooking)
);

export default router;
