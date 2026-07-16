import { Router }
from "express";

import auth
from "../middleware/auth.middleware.js";

import validation
from "../middleware/validation.middleware.js";

import {
  joinOrganizationSchema,
}
from "../validations/membership.validation.js";

import {
  joinOrganization,
  approveMembership,
  myOrganizations,
}
from "../controller/membership.controller.js";

const router = Router();

router.post(
  "/join",
  auth,
  validation(
    joinOrganizationSchema
  ),
  joinOrganization
);

router.patch(
  "/approve/:id",
  auth,
  approveMembership
);

router.get(
  "/my-organizations",
  auth,
  myOrganizations
);

export default router;