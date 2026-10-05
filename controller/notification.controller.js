import mongoose from "mongoose";

import Notification from "../models/notification.js";
import { notFound } from "../utils/apiError.js";

const readPage = (value, fallback = 1) => Math.max(1, Number(value) || fallback);
const readLimit = (value, fallback = 20) =>
  Math.min(Math.max(1, Number(value) || fallback), 100);

// GET /notifications?unread=true&type=&page&limit
export const getNotifications = async (req, res) => {
  const { unread, type } = req.query;

  const filter = { user: req.user._id };

  if (unread === "true") filter.isRead = false;
  if (type) filter.type = String(type);

  const currentPage = readPage(req.query.page);
  const perPage = readLimit(req.query.limit);

  const [data, totalItems, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(totalItems / perPage) || 1,
    totalItems,
    // Always returned so the bell badge needs no extra request.
    unreadCount,
    data,
  });
};

// GET /notifications/unread-count
export const getUnreadCount = async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  return res.status(200).json({ success: true, data: { unreadCount } });
};

// PATCH /notifications/:id/read
export const markAsRead = async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  ).lean();

  if (!notification) throw notFound("Notification not found");

  return res.status(200).json({
    success: true,
    message: "Notification marked as read",
    data: notification,
  });
};

// PATCH /notifications/read-all
export const markAllAsRead = async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return res.status(200).json({
    success: true,
    message: "All notifications marked as read",
    data: { updated: result.modifiedCount ?? 0 },
  });
};

// DELETE /notifications/:id
export const deleteNotification = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Notification not found");
  }

  const result = await Notification.deleteOne({
    _id: id,
    user: req.user._id,
  });

  if (!result.deletedCount) throw notFound("Notification not found");

  return res.status(200).json({
    success: true,
    message: "Notification deleted",
  });
};
