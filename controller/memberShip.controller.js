import mongoose from "mongoose";

import Organization from "../models/organization.js";
import OrganizationMembership from "../models/organizationMembership.js";
import notify, { notifyMany } from "../utils/notify.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/apiError.js";
import { MANAGER_MEMBERSHIP_ROLES } from "../config/domain.js";
import {
  canManageOrganization,
  isAdmin,
  ROLES,
} from "../utils/permissions.js";
import User from "../models/user.js";

// POST /memberships/join
// Anyone can ask to join. The request lands in the organization's queue.
export const joinOrganization = async (req, res) => {
  const { organizationId, role } = req.body;

  const organization = await Organization.findById(organizationId).lean();

  if (!organization || !organization.isActive) {
    throw notFound("Organization not found");
  }

  const existing = await OrganizationMembership.findOne({
    user: req.user._id,
    organization: organizationId,
  });

  if (existing) {
    throw conflict(
      existing.status === "pending"
        ? "You already have a pending request for this organization"
        : "You are already a member of this organization"
    );
  }

  const membership = await OrganizationMembership.create({
    user: req.user._id,
    organization: organizationId,
    role,
  });

  // Tell whoever runs the organization, and keep an admin copy.
  const managers = await OrganizationMembership.find({
    organization: organizationId,
    status: "approved",
    role: { $in: MANAGER_MEMBERSHIP_ROLES },
  }).select("user");

  const admins = await User.find({ role: ROLES.ADMIN, isActive: true })
    .select("_id")
    .lean();

  await notify({
    user: req.user._id,
    type: "membership_request",
    data: { organizationId, organizationName: organization.name, role },
  });

  await notifyMany({
    users: [
      ...managers.map((m) => m.user),
      ...admins.map((a) => a._id),
    ],
    type: "membership_request",
    data: {
      membershipId: membership._id,
      organizationId,
      organizationName: organization.name,
      requesterName: `${req.user.firstName} ${req.user.lastName}`,
      role,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Membership request sent",
    data: membership,
  });
};

// GET /memberships/my-organizations?status
// Defaults to approved, but the client can also ask for its pending ones.
export const myOrganizations = async (req, res) => {
  const { status } = req.query;

  const filter = { user: req.user._id };

  if (status) {
    filter.status = String(status).toLowerCase();
  }

  const memberships = await OrganizationMembership.find(filter)
    .populate("organization", "name slug type logo governorate address location")
    .sort({ updatedAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: memberships,
  });
};

// PATCH /memberships/approve/:id
// Admin, or a manager of the organization the request targets.
export const approveMembership = async (req, res) =>
  decide(req, res, "approved");

// PATCH /memberships/reject/:id
export const rejectMembership = async (req, res) =>
  decide(req, res, "rejected");

const decide = async (req, res, decision) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Membership request not found");
  }

  const membership = await OrganizationMembership.findById(id)
    .populate("organization", "name type")
    .lean();

  if (!membership) throw notFound("Membership request not found");

  if (!(await canManageOrganization(req.user, membership.organization._id))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to review this request",
    });
  }

  if (membership.status !== "pending") {
    throw badRequest(`This request was already ${membership.status}`);
  }

  const updated = await OrganizationMembership.findByIdAndUpdate(
    id,
    {
      status: decision,
      ...(decision === "approved" ? { joinedAt: new Date() } : {}),
    },
    { new: true }
  )
    .populate("organization", "name type")
    .lean();

  await notify({
    user: membership.user,
    type:
      decision === "approved"
        ? "membership_approved"
        : "membership_rejected",
    data: {
      organizationId: membership.organization?._id,
      organizationName: membership.organization?.name,
      role: membership.role,
    },
  });

  return res.status(200).json({
    success: true,
    message:
      decision === "approved" ? "Membership approved" : "Membership rejected",
    data: updated,
  });
};

// GET /memberships/requests
// The queue this user is allowed to act on.
export const getMembershipRequests = async (req, res) => {
  const { status = "pending" } = req.query;

  if (!isAdmin(req.user)) {
    const managed = await OrganizationMembership.find({
      user: req.user._id,
      status: "approved",
      role: { $in: MANAGER_MEMBERSHIP_ROLES },
    }).select("organization");

    const organizationIds = managed.map((m) => m.organization);

    if (!organizationIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const data = await OrganizationMembership.find({
      organization: { $in: organizationIds },
      status: String(status).toLowerCase(),
    })
      .populate("user", "firstName lastName email")
      .populate("organization", "name type slug")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data });
  }

  const data = await OrganizationMembership.find({
    status: String(status).toLowerCase(),
  })
    .populate("user", "firstName lastName email")
    .populate("organization", "name type slug")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data });
};

// DELETE /memberships/:id
// The requester withdraws their own request.
export const leaveOrganization = async (req, res) => {
  const { id } = req.params;

  const membership = await OrganizationMembership.findById(id);

  if (!membership) throw notFound("Membership not found");

  if (String(membership.user) !== String(req.user._id)) {
    throw forbidden("You can only leave an organization you joined yourself");
  }

  await membership.deleteOne();

  return res.status(200).json({
    success: true,
    message: "You have left the organization",
  });
};
