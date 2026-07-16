import { Router }
from "express";

import auth
from "../middleware/auth.middleware.js";

import authorize
from "../middleware/authorization.middleware.js";

import validation
from "../middleware/validation.middleware.js";

import {
  createResourceSchema,
} from "../validations/resource.validation.js";

import {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  deleteResource,
} from "../controller/resource.controller.js";

const router = Router();

router.post(
  "/",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  validation(
    createResourceSchema
  ),
  createResource
);

router.get(
  "/",
  getResources
);

router.get(
  "/:id",
  getResourceById
);

router.patch(
  "/:id",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  updateResource
);

router.delete(
  "/:id",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  deleteResource
);

export default router;