import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import validation from "../middleware/validation.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import {
  createResourceSchema,
  updateResourceSchema,
} from "../validations/resource.validation.js";

import Joi from "joi";

import {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
  updateResourceStatus,
  getManageableResources,
} from "../controller/resource.controller.js";

const router = Router();

// Staff listing of what this user is responsible for. Registered before
// `/:id` so "manageable" isn't read as an id.
router.get(
  "/manageable",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getManageableResources)
);

router.get(
  "/",
  asyncHandler(getResources)
);

router.get(
  "/:id",
  asyncHandler(getResourceById)
);

// =========================
// Writes
// =========================

router.post(
  "/",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(createResourceSchema),
  asyncHandler(createResource)
);

router.patch(
  "/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(updateResourceSchema),
  asyncHandler(updateResource)
);

router.delete(
  "/:id",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(deleteResource)
);

// The technician's primary action: available / booked / maintenance.
router.patch(
  "/:id/status",
  auth,
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  validation(
    Joi.object({
      status: Joi.string()
        .valid("available", "booked", "maintenance")
        .required(),
      note: Joi.string().trim().max(1000).allow("", null).optional(),
    })
  ),
  asyncHandler(updateResourceStatus)
);

export default router;
