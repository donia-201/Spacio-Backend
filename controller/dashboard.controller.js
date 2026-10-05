import Booking from "../models/booking.js";
import Notification from "../models/notification.js";
import Organization from "../models/organization.js";
import OrganizationMembership from "../models/organizationMembership.js";
import Resource from "../models/resource.js";
import User from "../models/user.js";
import { MANAGER_MEMBERSHIP_ROLES } from "../config/domain.js";
import { isAdmin, organizationScope } from "../utils/permissions.js";

const groupCounts = async (model, field, filter = {}) => {
  const rows = await model.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});
};

// =========================
// GET /dashboard/summary
// Small payload the navbar badge can poll. Works for all three roles.
// =========================

export const getSummary = async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  return res.status(200).json({
    success: true,
    data: {
      unreadNotifications: unreadCount,
      role: req.user.role,
      locationPermission: req.user.locationPermission,
    },
  });
};

// =========================
// GET /dashboard/admin
// Admin only.
// =========================

export const getAdminDashboard = async (req, res) => {
  const [
    totalUsers,
    usersByRole,
    newUsersThisMonth,
    totalOrganizations,
    organizationsByType,
    inactiveOrganizations,
    totalResources,
    resourcesByStatus,
    resourcesByType,
    totalBookings,
    bookingsByStatus,
    bookingsThisMonth,
    pendingMemberships,
    usersWithLocation,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    groupCounts(User, "role", { isActive: true }),
    User.countDocuments({
      isActive: true,
      createdAt: {
        $gte: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ),
      },
    }),
    Organization.countDocuments({ isActive: true }),
    groupCounts(Organization, "type", { isActive: true }),
    Organization.countDocuments({ isActive: false }),
    Resource.countDocuments({ isActive: { $ne: false } }),
    groupCounts(Resource, "status", { isActive: { $ne: false } }),
    groupCounts(Resource, "type", { isActive: { $ne: false } }),
    Booking.countDocuments(),
    groupCounts(Booking, "status"),
    Booking.countDocuments({
      createdAt: {
        $gte: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ),
      },
    }),
    OrganizationMembership.countDocuments({ status: "pending" }),
    User.countDocuments({
      isActive: true,
      locationPermission: "granted",
    }),
  ]);

  // Top organizations by how much people book them.
  const topOrganizations = await Organization.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "organization",
        as: "bookings",
      },
    },
    {
      $project: {
        name: 1,
        type: 1,
        slug: 1,
        governorate: 1,
        bookings: { $size: "$bookings" },
      },
    },
    { $sort: { bookings: -1 } },
    { $limit: 8 },
  ]);

  // Last 14 days of booking volume, for a sparkline.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const trend = await Booking.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const recentBookings = await Booking.find()
    .populate("user", "firstName lastName")
    .populate("resource", "name type")
    .populate("organization", "name")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const recentUsers = await User.find({ isActive: true })
    .select("firstName lastName email role locationPermission createdAt")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        byRole: usersByRole,
        newThisMonth: newUsersThisMonth,
        withLocation: usersWithLocation,
      },
      organizations: {
        total: totalOrganizations,
        byType: organizationsByType,
        deactivated: inactiveOrganizations,
      },
      resources: {
        total: totalResources,
        byStatus: resourcesByStatus,
        byType: resourcesByType,
      },
      bookings: {
        total: totalBookings,
        byStatus: bookingsByStatus,
        thisMonth: bookingsThisMonth,
      },
      memberships: {
        pending: pendingMemberships,
      },
      topOrganizations,
      bookingTrend: trend,
      recentBookings,
      recentUsers,
    },
  });
};

// =========================
// GET /dashboard/technician
// Technicians (and admins, who can preview it) only.
// Scoped to the resources they created or the organizations they manage.
// =========================

export const getTechnicianDashboard = async (req, res) => {
  const scope = await organizationScope(req.user);

  // Which resources are in this technician's care?
  const resourceFilter = isAdmin(req.user)
    ? {}
    : scope === null
      ? { createdBy: req.user._id }
      : {
          $or: [
            { createdBy: req.user._id },
            ...(scope.length ? [{ organization: { $in: scope } }] : []),
          ],
        };

  const managedResourceIds = await Resource.find(resourceFilter)
    .select("_id")
    .lean();

  const ids = managedResourceIds.map((r) => r._id);

  const bookingFilter = ids.length ? { resource: { $in: ids } } : { _id: null };

  const [
    totalResources,
    byStatus,
    maintenanceCount,
    totalBookings,
    bookingsByStatus,
    pendingBookings,
    upcomingBookings,
    organizationsManaged,
  ] = await Promise.all([
    Resource.countDocuments(resourceFilter),
    groupCounts(Resource, "status", resourceFilter),
    Resource.countDocuments({ ...resourceFilter, status: "maintenance" }),
    Booking.countDocuments(bookingFilter),
    groupCounts(Booking, "status", bookingFilter),
    Booking.countDocuments({ ...bookingFilter, status: "pending" }),
    Booking.find({
      ...bookingFilter,
      status: "approved",
      startTime: { $gte: new Date() },
    })
      .populate("user", "firstName lastName")
      .populate("resource", "name type")
      .populate("organization", "name")
      .sort({ startTime: 1 })
      .limit(10)
      .lean(),
    isAdmin(req.user)
      ? Organization.countDocuments({ isActive: true })
      : OrganizationMembership.countDocuments({
          user: req.user._id,
          status: "approved",
          role: { $in: MANAGER_MEMBERSHIP_ROLES },
        }),
  ]);

  const queue = ids.length
    ? await Booking.find({ ...bookingFilter, status: "pending" })
        .populate("user", "firstName lastName email")
        .populate("resource", "name type")
        .populate("organization", "name")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    : [];

  // Resources that need attention first: in maintenance, then unavailable.
  const needsAttention = await Resource.find({
    ...resourceFilter,
    status: { $in: ["maintenance", "booked"] },
  })
    .populate("organization", "name type")
    .sort({ updatedAt: -1 })
    .limit(10)
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      scope:
        scope === null
          ? "all"
          : { organizations: scope, organizationCount: scope.length },
      resources: {
        total: totalResources,
        byStatus,
        inMaintenance: maintenanceCount,
        needsAttention,
      },
      bookings: {
        total: totalBookings,
        byStatus: bookingsByStatus,
        pending: pendingBookings,
        queue,
        upcoming: upcomingBookings,
      },
      organizationsManaged,
    },
  });
};

// =========================
// GET /dashboard/user
// Everything the signed-in user's own home screen needs.
// =========================

export const getUserDashboard = async (req, res) => {
  const [bookingsByStatus, totalBookings, upcoming, organizations, unread] =
    await Promise.all([
      groupCounts(Booking, "status", { user: req.user._id }),
      Booking.countDocuments({ user: req.user._id }),
      Booking.find({
        user: req.user._id,
        status: { $in: ["pending", "approved"] },
        endTime: { $gte: new Date() },
      })
        .populate("resource", "name type")
        .populate("organization", "name")
        .sort({ startTime: 1 })
        .limit(5)
        .lean(),
      OrganizationMembership.find({
        user: req.user._id,
        status: "approved",
      })
        .populate("organization", "name slug type logo")
        .lean(),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

  return res.status(200).json({
    success: true,
    data: {
      bookings: { total: totalBookings, byStatus: bookingsByStatus, upcoming },
      organizations,
      unreadNotifications: unread,
      locationPermission: req.user.locationPermission,
    },
  });
};
