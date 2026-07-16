import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";

import {
  createBookingSchema,
} from "../validations/booking.validation.js";

import {
  createBooking,
  myBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
  cancelBooking,
} from "../controller/booking.controller.js";

const router = Router();

router.post(
  "/",
  auth,
  validation(createBookingSchema),
  createBooking
);

router.get(
  "/my-bookings",
  auth,
  myBookings
);

router.get(
  "/:id",
  auth,
  getBookingById
);

router.patch(
  "/:id/approve",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  approveBooking
);

router.patch(
  "/:id/reject",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  rejectBooking
);

router.patch(
  "/:id/cancel",
  auth,
  cancelBooking
);

export default router;