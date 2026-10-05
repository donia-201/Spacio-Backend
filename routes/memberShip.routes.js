import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import { joinOrganizationSchema } from "../validations/membership.validation.js";

import {
  joinOrganization,
  myOrganizations,
  getMembershipRequests,
  approveMembership,
  rejectMembership,
  leaveOrganization,
} from "../controller/membership.controller.js";

const router = Router();

router.post(
  "/join",
  auth,
  validation(joinOrganizationSchema),
  asyncHandler(joinOrganization)
);

router.get(
  "/my-organizations",
  auth,
  asyncHandler(myOrganizations)
);

// The queue this user can act on: everything for an admin, their managed
// organizations for a technician.
router.get(
  "/requests",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getMembershipRequests)
);

router.patch(
  "/approve/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(approveMembership)
);

router.patch(
  "/reject/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(rejectMembership)
);

router.delete(
  "/:id",
  auth,
  asyncHandler(leaveOrganization)
);

export default router;
