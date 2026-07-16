import { Router } from "express";

import auth from "../middleware/auth.middleware.js";

import validation from "../middleware/validation.middleware.js";

import {
  createOrganizationSchema,
} from "../validations/organization.validation.js";

import {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  getNearbyOrganizations,
} from "../controller/organization.controller.js";

import authorize from "../middleware/authorization.middleware.js";
const router = Router();

router.post(
  "/",
  auth,
  validation(
    createOrganizationSchema
  ),
  createOrganization
);

router.get(
  "/",
  getOrganizations
);


router.patch(
  "/:id",
  auth,
  updateOrganization
);

router.delete(
  "/:id",
  auth,
  deleteOrganization
);

router.get(
  "/nearby",
  getNearbyOrganizations
);

router.get(
  "/:id",
  getOrganizationById
);

router.post(
  "/",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  validation(createOrganizationSchema),
  createOrganization
);

router.patch(
  "/:id",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  updateOrganization
);

router.delete(
  "/:id",
  auth,
  authorize(
    "admin",
    "super_admin"
  ),
  deleteOrganization
);

export default router;