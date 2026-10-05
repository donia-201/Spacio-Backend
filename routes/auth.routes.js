import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import {
  signup,
  login,
  getProfile,
  updateProfile,
  updateLocation,
  changePassword,
} from "../controller/auth.controller.js";

import {
  signupSchema,
  loginSchema,
  changePassSchema,
  locationSchema,
  updateProfileSchema,
} from "../validations/auth.validation.js";

import {
  getUsers,
  getUserById,
  updateUserRole,
} from "../controller/user.controller.js";
import { updateUserRoleSchema } from "../validations/auth.validation.js";

const router = Router();

router.post(
  "/signup",
  validation(signupSchema),
  asyncHandler(signup)
);

router.post(
  "/login",
  validation(loginSchema),
  asyncHandler(login)
);

router.patch(
  "/change-password",
  auth,
  validation(changePassSchema),
  asyncHandler(changePassword)
);

router.get(
  "/profile",
  auth,
  asyncHandler(getProfile)
);

router.patch(
  "/profile",
  auth,
  validation(updateProfileSchema),
  asyncHandler(updateProfile)
);

// The browser geolocation prompt posts its answer here.
router.patch(
  "/location",
  auth,
  validation(locationSchema),
  asyncHandler(updateLocation)
);

// =========================
// Admin: user management
// =========================

router.get(
  "/users",
  auth,
  authorize(ROLES.ADMIN),
  asyncHandler(getUsers)
);

router.get(
  "/users/:id",
  auth,
  authorize(ROLES.ADMIN),
  asyncHandler(getUserById)
);

router.patch(
  "/users/:id/role",
  auth,
  authorize(ROLES.ADMIN),
  validation(updateUserRoleSchema),
  asyncHandler(updateUserRole)
);

export default router;
