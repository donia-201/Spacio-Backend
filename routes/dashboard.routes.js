import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import authorize from "../middleware/authorization.middleware.js";
import { asyncHandler } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

import {
  getSummary,
  getAdminDashboard,
  getTechnicianDashboard,
  getUserDashboard,
} from "../controller/dashboard.controller.js";

const router = Router();

router.use(auth);

// Works for all three roles — used for the navbar badge.
router.get(
  "/summary",
  asyncHandler(getSummary)
);

router.get(
  "/user",
  asyncHandler(getUserDashboard)
);

router.get(
  "/admin",
  authorize(ROLES.ADMIN),
  asyncHandler(getAdminDashboard)
);

router.get(
  "/technician",
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  asyncHandler(getTechnicianDashboard)
);

export default router;
