import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "../validations/organization.validation.js";

import {
  createOrganization,
  getOrganizations,
  getNearbyOrganizations,
  getCategoryOverview,
  getOrganizationTypes,
  getOrganizationById,
  getOrganizationResources,
  updateOrganization,
  deleteOrganization,
  getManageableOrganizations,
  getOrganizationMembers,
  getPendingMembershipRequests,
  decideMembershipRequest,
} from "../controller/organization.controller.js";

import Joi from "joi";

const router = Router();

// =========================
// Public reads
//
// Order matters: the literal paths below must be registered before `/:id`
// or Express will try to match them against the id parameter.
// =========================

router.get(
  "/meta/types",
  asyncHandler(getOrganizationTypes)
);

router.get(
  "/categories",
  asyncHandler(getCategoryOverview)
);

router.get(
  "/nearby",
  asyncHandler(getNearbyOrganizations)
);

router.get(
  "/",
  asyncHandler(getOrganizations)
);

// =========================
// Staff reads
// =========================

router.get(
  "/manageable",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getManageableOrganizations)
);

router.get(
  "/pending-requests",
  auth,
  authorize(ROLES.ADMIN),
  asyncHandler(getPendingMembershipRequests)
);

router.get(
  "/members/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getOrganizationMembers)
);

// =========================
// Admin writes
// =========================

router.post(
  "/",
  auth,
  authorize(ROLES.ADMIN),
  validation(createOrganizationSchema),
  asyncHandler(createOrganization)
);

router.patch(
  "/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(updateOrganizationSchema),
  asyncHandler(updateOrganization)
);

router.delete(
  "/:id",
  auth,
  authorize(ROLES.ADMIN),
  asyncHandler(deleteOrganization)
);

router.patch(
  "/:id/memberships/:membershipId",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(
    Joi.object({
      decision: Joi.string().valid("approved", "rejected").required(),
      note: Joi.string().trim().max(1000).allow("", null).optional(),
    })
  ),
  asyncHandler(decideMembershipRequest)
);

// =========================
// Public per-organization reads
// =========================

router.get(
  "/:id",
  asyncHandler(getOrganizationById)
);

router.get(
  "/:id/resources",
  asyncHandler(getOrganizationResources)
);

export default router;
