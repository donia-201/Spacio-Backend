import { Router } from "express";

import auth from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/apiError.js";

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controller/notification.controller.js";

const router = Router();

// Every route here is scoped to the signed-in user in the controller.
router.get(
  "/",
  auth,
  asyncHandler(getNotifications)
);

router.get(
  "/unread-count",
  auth,
  asyncHandler(getUnreadCount)
);

router.patch(
  "/read-all",
  auth,
  asyncHandler(markAllAsRead)
);

router.patch(
  "/:id/read",
  auth,
  asyncHandler(markAsRead)
);

router.delete(
  "/:id",
  auth,
  asyncHandler(deleteNotification)
);

export default router;
