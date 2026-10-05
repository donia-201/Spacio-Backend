import Notification from "../models/notification.js";

// =========================
// Single place that writes notifications, so the copy + the deep-link
// payload stay consistent across the app.
// =========================

const TEMPLATES = {
  location_permission: {
    title: "Turn on location",
    message:
      "Allow Spacio to use your location so we can show the hospitals, workspaces, libraries and universities closest to you.",
    data: { action: "location", route: "/welcome/location" },
  },

  welcome: {
    title: "Welcome to Spacio",
    message: "Your account is ready. Let's find a space near you.",
    data: { action: "explore", route: "/home" },
  },

  membership_request: {
    title: "New membership request",
    message: "You have a new request to join an organization.",
    data: { action: "membership" },
  },

  membership_approved: {
    title: "Membership approved",
    message: "Your request to join this organization was approved.",
    data: { action: "membership" },
  },

  membership_rejected: {
    title: "Membership rejected",
    message: "Your request to join this organization was declined.",
    data: { action: "membership" },
  },

  booking_created: {
    title: "Booking requested",
    message: "We sent your booking request to the organization.",
    data: { action: "booking" },
  },

  booking_approved: {
    title: "Booking approved",
    message: "Your booking was approved. See you there.",
    data: { action: "booking" },
  },

  booking_rejected: {
    title: "Booking rejected",
    message: "Your booking request was declined. Try another time slot.",
    data: { action: "booking" },
  },

  booking_cancelled: {
    title: "Booking cancelled",
    message: "Your booking was cancelled.",
    data: { action: "booking" },
  },

  resource_assigned: {
    title: "Resource assigned to you",
    message: "A resource was assigned to you to manage.",
    data: { action: "resource" },
  },

  resource_status_changed: {
    title: "Resource status changed",
    message: "The status of a resource you manage has changed.",
    data: { action: "resource" },
  },

  system: {
    title: "Spacio",
    message: "",
    data: {},
  },
};

// Never let a notification failure break the action that triggered it.
const notify = async ({ user, type, data, title, message }) => {
  const userId = user?._id ?? user;

  if (!userId) return null;

  const template = TEMPLATES[type] ?? TEMPLATES.system;

  try {
    return await Notification.create({
      user: userId,
      type,
      title: title ?? template.title,
      message: message ?? template.message,
      data: { ...template.data, ...(data ?? {}) },
    });
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
};

// Fan out to many recipients (e.g. every admin gets a new booking request).
const notifyMany = async ({ users, type, data, title, message }) => {
  const userIds = (users ?? []).map((user) => user?._id ?? user).filter(Boolean);
  if (!userIds.length) return [];

  try {
    const template = TEMPLATES[type] ?? TEMPLATES.system;
    const docs = userIds.map((user) => ({
      user,
      type,
      title: title ?? template.title,
      message: message ?? template.message,
      data: { ...template.data, ...(data ?? {}) },
    }));
    return await Notification.insertMany(docs);
  } catch (error) {
    console.error("Failed to create notifications:", error.message);
    return [];
  }
};

export { TEMPLATES };
export default notify;
export { notifyMany };
