import mongoose from "mongoose";

// Every value here is a `type` the client can branch on. Keep in sync with
// utils/notify.js which is the only writer.
export const NOTIFICATION_TYPES = [
  "location_permission",
  "welcome",
  "membership_request",
  "membership_approved",
  "membership_rejected",
  "booking_created",
  "booking_approved",
  "booking_rejected",
  "booking_cancelled",
  "resource_assigned",
  "resource_status_changed",
  "system",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional deep-link so the client can route the bell icon:
    //   { "action": "location",      "route": "/welcome/location" }
    //   { "action": "booking",       "route": "/bookings/<id>" }
    //   { "action": "membership",    "route": "/organizations/<id>" }
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Listing a user's inbox: newest first, unread for the bell badge.
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
