import mongoose from "mongoose";

import Booking from "../models/booking.js";
import OrganizationMembership from "../models/organizationMembership.js";
import User from "../models/user.js";
import { badRequest, notFound } from "../utils/apiError.js";
import { ROLES } from "../utils/permissions.js";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone ?? "",
  role: user.role,
  profileImage: user.profileImage ?? null,
  locationPermission: user.locationPermission,
  location: user.location?.coordinates ? user.location : null,
  governorate: user.governorate ?? "",
  city: user.city ?? "",
  searchRadius: user.searchRadius,
  isActive: user.isActive,
  isVerified: user.isVerified,
  lastLogin: user.lastLogin ?? null,
  createdAt: user.createdAt,
});

// GET /auth/users?role=&search=&page=&limit
export const getUsers = async (req, res) => {
  const { role, search, isActive } = req.query;

  const filter = {};

  if (role) {
    if (![ROLES.USER, ROLES.TECHNICIAN, ROLES.ADMIN].includes(role)) {
      throw badRequest(`Unknown role "${role}"`);
    }
    filter.role = role;
  }

  if (isActive === "true" || isActive === "false") {
    filter.isActive = isActive === "true";
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
  }

  const currentPage = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(Math.max(1, Number(req.query.limit) || 25), 100);

  const [data, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data,
  });
};

// GET /auth/users/:id
export const getUserById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound("User not found");

  const user = await User.findById(id).lean();

  if (!user) throw notFound("User not found");

  const [memberships, bookingCount] = await Promise.all([
    OrganizationMembership.find({ user: id })
      .populate("organization", "name type slug")
      .lean(),
    Booking.countDocuments({ user: id }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...publicUser(user),
      memberships,
      bookingCount,
    },
  });
};

// PATCH /auth/users/:id/role
// How an admin grants or revokes the technician and admin roles.
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role, isActive } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound("User not found");

  // Don't let the last admin demote themselves out of existence.
  if (String(id) === String(req.user._id)) {
    if (role && role !== ROLES.ADMIN) {
      throw badRequest("You cannot change your own role");
    }
    if (isActive === false) {
      throw badRequest("You cannot disable your own account");
    }
  }

  const user = await User.findById(id);

  if (!user) throw notFound("User not found");

  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  return res.status(200).json({
    success: true,
    message: "User updated successfully",
    data: publicUser(user.toObject()),
  });
};
