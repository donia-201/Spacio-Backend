import OrganizationMembership from "../models/organizationMembership.js";

import { MANAGER_MEMBERSHIP_ROLES } from "../config/domain.js";

// =========================
// Who is allowed to do what.
//
//  user       -> browse, book, manage own bookings/profile/notifications
//  technician -> everything a user can, plus flip the status of resources
//                they own or that belong to an organization they manage
//  admin      -> full platform control: organizations, every resource,
//                approve/reject any booking or membership, all stats
// =========================

export const ROLES = {
  USER: "user",
  TECHNICIAN: "technician",
  ADMIN: "admin",
};

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

export const isTechnician = (user) => user?.role === ROLES.TECHNICIAN;

export const isStaff = (user) =>
  user?.role === ROLES.ADMIN || user?.role === ROLES.TECHNICIAN;

// All approved memberships this user holds, shaped as a Set of org ids.
const managedOrganizationIds = async (user) => {
  const memberships = await OrganizationMembership.find({
    user: user._id,
    status: "approved",
    role: { $in: MANAGER_MEMBERSHIP_ROLES },
  }).select("organization");

  return new Set(
    memberships.map((m) => String(m.organization?._id ?? m.organization))
  );
};

// Admins manage everything. Technicians manage an organization only when
// they are an approved manager / building_admin of it.
export const canManageOrganization = async (user, organizationId) => {
  if (isAdmin(user)) return true;
  if (!organizationId) return false;
  const ids = await managedOrganizationIds(user);
  return ids.has(String(organizationId));
};

export const canManageResource = async (user, resource) => {
  if (!resource) return false;
  if (isAdmin(user)) return true;

  if (String(resource.createdBy ?? "") === String(user._id)) return true;

  if (!isStaff(user)) return false;

  const organizationId = resource.organization?._id ?? resource.organization;
  if (!organizationId) return false;

  const ids = await managedOrganizationIds(user);
  return ids.has(String(organizationId));
};

// The set of organization ids a user administers, for filtering list queries.
export const organizationScope = async (user) => {
  if (isAdmin(user)) return null; // null = unrestricted
  const ids = await managedOrganizationIds(user);
  return [...ids];
};
