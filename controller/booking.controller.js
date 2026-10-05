import mongoose from "mongoose";

import Booking from "../models/booking.js";
import OrganizationMembership from "../models/organizationMembership.js";
import Resource from "../models/resource.js";
import User from "../models/user.js";
import notify, { notifyMany } from "../utils/notify.js";
import { badRequest, forbidden, notFound } from "../utils/apiError.js";
import {
  MANAGER_MEMBERSHIP_ROLES,
  RESOURCE_TYPES,
} from "../config/domain.js";
import { isAdmin, ROLES } from "../utils/permissions.js";

const readPage = (value, fallback = 1) => Math.max(1, Number(value) || fallback);

const readLimit = (value, fallback = 10) =>
  Math.min(Math.max(1, Number(value) || fallback), 100);

const POPULATE = [
  { path: "resource", select: "name type status location organization" },
  { path: "organization", select: "name type slug" },
];

const withLabels = (booking) =>
  booking?.resource
    ? {
        ...booking,
        resource: {
          ...booking.resource,
          typeLabel:
            RESOURCE_TYPES[booking.resource.type] ?? booking.resource.type,
        },
      }
    : booking;

// Everyone who should hear about a decision on this booking's resource:
// admins, the organization managers, and the technician who owns it.
const decisionRecipients = async (booking) => {
  const recipients = new Map();

  const admins = await User.find({ role: ROLES.ADMIN, isActive: true })
    .select("_id")
    .lean();
  admins.forEach((user) => recipients.set(String(user._id), user._id));

  const managers = await OrganizationMembership.find({
    organization: booking.organization,
    status: "approved",
    role: { $in: MANAGER_MEMBERSHIP_ROLES },
  })
    .select("user")
    .lean();
  managers.forEach((m) => recipients.set(String(m.user), m.user));

  if (booking.resource?.createdBy) {
    recipients.set(String(booking.resource.createdBy), booking.resource.createdBy);
  }

  return [...recipients.values()];
};

// =========================
// Create
// =========================

export const createBooking = async (req, res) => {
  const { resource: resourceId, organization, startTime, endTime, notes } =
    req.body;

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    throw badRequest("endTime must be after startTime");
  }

  if (start < new Date()) {
    throw badRequest("startTime cannot be in the past");
  }

  const resource = await Resource.findById(resourceId);

  if (!resource || resource.isActive === false) {
    throw notFound("Resource not found");
  }

  // Don't let the client book a resource against the wrong organization.
  if (String(resource.organization) !== String(organization)) {
    throw badRequest("That resource does not belong to this organization");
  }

  if (resource.status === "maintenance") {
    throw badRequest("This resource is under maintenance");
  }

  // Overlap check against anything still holding the slot.
  const conflict = await Booking.findOne({
    resource: resourceId,
    status: { $in: ["pending", "approved"] },
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).select("_id status startTime endTime");

  if (conflict) {
    throw badRequest("This resource is already booked during this time");
  }

  const booking = await Booking.create({
    user: req.user._id,
    resource: resourceId,
    organization,
    startTime: start,
    endTime: end,
    notes,
    // A resource that doesn't require approval is confirmed immediately.
    status: resource.requiresApproval === false ? "approved" : "pending",
  });

  await notify({
    user: req.user._id,
    type: "booking_created",
    data: {
      bookingId: booking._id,
      resourceId,
      resourceName: resource.name,
      organizationId: organization,
      status: booking.status,
    },
  });

  const recipients = await decisionRecipients({
    organization,
    resource: { createdBy: resource.createdBy },
  });

  await notifyMany({
    users: recipients,
    type: "booking_created",
    data: {
      bookingId: booking._id,
      resourceId,
      resourceName: resource.name,
      organizationId: organization,
      requesterName: `${req.user.firstName} ${req.user.lastName}`,
    },
  });

  const populated = await booking.populate(POPULATE);

  return res.status(201).json({
    success: true,
    message: "Booking request submitted",
    data: withLabels(populated),
  });
};

// =========================
// Read
// =========================

// GET /bookings/my-bookings?page&limit&status
export const myBookings = async (req, res) => {
  const { status } = req.query;

  const filter = { user: req.user._id };
  if (status) filter.status = String(status).toLowerCase();

  const currentPage = readPage(req.query.page);
  const perPage = readLimit(req.query.limit);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate(POPULATE)
      .sort({ startTime: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data: bookings.map(withLabels),
  });
};

// GET /bookings/manageable?status
// Staff queue: every booking they are allowed to decide on.
export const getManageableBookings = async (req, res) => {
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = String(status).toLowerCase();

  if (!isAdmin(req.user)) {
    const memberships = await OrganizationMembership.find({
      user: req.user._id,
      status: "approved",
      role: { $in: MANAGER_MEMBERSHIP_ROLES },
    }).select("organization");

    const organizationIds = memberships.map((m) => m.organization);

    const ownedResources = await Resource.find({ createdBy: req.user._id })
      .select("_id");

    filter.$or = [
      ...(organizationIds.length
        ? [{ organization: { $in: organizationIds } }]
        : []),
      { resource: { $in: ownedResources.map((r) => r._id) } },
    ];

    if (!filter.$or.length) {
      return res.status(200).json({
        success: true,
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        data: [],
      });
    }
  }

  const currentPage = readPage(req.query.page);
  const perPage = readLimit(req.query.limit, 20);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate(POPULATE)
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data: bookings.map(withLabels),
  });
};

// GET /bookings/:id  (owner or a decider)
export const getBookingById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Booking not found");
  }

  const booking = await Booking.findById(id)
    .populate(POPULATE)
    .populate("user", "firstName lastName email")
    .lean();

  if (!booking) throw notFound("Booking not found");

  const isOwner = String(booking.user?._id ?? booking.user) === String(req.user._id);

  if (!isOwner) {
    const canSee =
      isAdmin(req.user) ||
      (await OrganizationMembership.exists({
        user: req.user._id,
        organization: booking.organization,
        status: "approved",
        role: { $in: MANAGER_MEMBERSHIP_ROLES },
      }));

    if (!canSee) throw forbidden("You do not have access to this booking");
  }

  return res.status(200).json({
    success: true,
    data: withLabels(booking),
  });
};

// =========================
// Decide
// =========================

const canDecide = async (user, booking) => {
  if (isAdmin(user)) return true;

  const managesOrganization = await OrganizationMembership.exists({
    user: user._id,
    organization: booking.organization,
    status: "approved",
    role: { $in: MANAGER_MEMBERSHIP_ROLES },
  });

  if (managesOrganization) return true;

  // The technician who owns the resource can clear its queue too.
  const resource = await Resource.findById(booking.resource)
    .select("createdBy organization")
    .lean();

  if (resource && String(resource.createdBy ?? "") === String(user._id)) {
    return true;
  }

  return false;
};

const decide = async (req, res, status, message) => {
  const { id } = req.params;
  const { note } = req.body ?? {};

  const booking = await Booking.findById(id);

  if (!booking) throw notFound("Booking not found");

  if (!(await canDecide(req.user, booking))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to review this booking",
    });
  }

  if (booking.status !== "pending") {
    throw badRequest(`This booking was already ${booking.status}`);
  }

  booking.status = status;
  booking.approvedBy = req.user._id;
  booking.decisionNote = note ?? "";
  await booking.save();

  await notify({
    user: booking.user,
    type:
      status === "approved" ? "booking_approved" : "booking_rejected",
    data: {
      bookingId: booking._id,
      resourceId: booking.resource,
      organizationId: booking.organization,
      note: note ?? "",
    },
  });

  const populated = await booking.populate(POPULATE);

  return res.status(200).json({
    success: true,
    message,
    data: withLabels(populated),
  });
};

export const approveBooking = async (req, res) =>
  decide(req, res, "approved", "Booking approved");

export const rejectBooking = async (req, res) =>
  decide(req, res, "rejected", "Booking rejected");

// PATCH /bookings/:id/cancel  (owner, or a decider)
export const cancelBooking = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body ?? {};

  const booking = await Booking.findById(id);

  if (!booking) throw notFound("Booking not found");

  const isOwner = String(booking.user) === String(req.user._id);

  if (!isOwner && !(await canDecide(req.user, booking))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to cancel this booking",
    });
  }

  if (["cancelled", "completed"].includes(booking.status)) {
    throw badRequest(`This booking is already ${booking.status}`);
  }

  booking.status = "cancelled";
  booking.decisionNote = note ?? "";
  await booking.save();

  if (!isOwner) {
    await notify({
      user: booking.user,
      type: "booking_cancelled",
      data: {
        bookingId: booking._id,
        resourceId: booking.resource,
        note: note ?? "",
      },
    });
  }

  const populated = await booking.populate(POPULATE);

  return res.status(200).json({
    success: true,
    message: "Booking cancelled",
    data: withLabels(populated),
  });
};

// PATCH /bookings/:id/complete
export const completeBooking = async (req, res) => {
  const { id } = req.params;

  const booking = await Booking.findById(id);

  if (!booking) throw notFound("Booking not found");

  if (!(await canDecide(req.user, booking))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to complete this booking",
    });
  }

  if (booking.status !== "approved") {
    throw badRequest("Only an approved booking can be completed");
  }

  booking.status = "completed";
  await booking.save();

  const populated = await booking.populate(POPULATE);

  return res.status(200).json({
    success: true,
    message: "Booking completed",
    data: withLabels(populated),
  });
};
