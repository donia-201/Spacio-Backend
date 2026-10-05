import mongoose from "mongoose";

import Organization from "../models/organization.js";
import OrganizationMembership from "../models/organizationMembership.js";
import Resource from "../models/resource.js";
import notify from "../utils/notify.js";
import { badRequest, notFound } from "../utils/apiError.js";
import {
  canManageOrganization,
  organizationScope,
} from "../utils/permissions.js";
import {
  describeAllOrganizationTypes,
  describeOrganizationType,
  ORGANIZATION_TYPE_KEYS,
  RESOURCE_TYPE_KEYS,
} from "../config/domain.js";

const MAX_LIMIT = 100;

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Accepts `lat`/`lng` (browser order) and normalises to GeoJSON
// [longitude, latitude]. Returns null when no position was supplied.
const readPoint = (query) => {
  const hasLat = query.lat !== undefined && query.lat !== "";
  const hasLng = query.lng !== undefined && query.lng !== "";

  if (!hasLat && !hasLng) return null;

  const lat = Number(query.lat);
  const lng = Number(query.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw badRequest("lat and lng must be valid coordinates");
  }

  return [lng, lat];
};

const readDistance = (query) => {
  const raw = query.distance ?? query.radius;
  if (raw === undefined || raw === "") return 5000;
  const distance = Number(raw);
  if (!Number.isFinite(distance) || distance <= 0) return 5000;
  return Math.min(distance, 100000);
};

const assertResourceType = (value) => {
  const type = String(value).toLowerCase();
  if (!RESOURCE_TYPE_KEYS.includes(type)) {
    throw badRequest(`Unknown resource type "${value}"`);
  }
  return type;
};

const readPage = (value, fallback) => Math.max(1, Number(value) || fallback);

const readLimit = (value, fallback) =>
  Math.min(Math.max(1, Number(value) || fallback), MAX_LIMIT);

const assertType = (type) => {
  if (!ORGANIZATION_TYPE_KEYS.includes(String(type).toLowerCase())) {
    throw badRequest(`Unknown organization type "${type}"`);
  }
  return String(type).toLowerCase();
};

const assertCoordinates = (coordinates) => {
  const [lng, lat] = coordinates ?? [];
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    throw badRequest("coordinates must be [longitude, latitude] within range");
  }
  return [lng, lat];
};

// =========================
// Create / update / delete
// =========================

export const createOrganization = async (req, res) => {
  const {
    name,
    slug,
    description,
    type,
    address,
    governorate,
    city,
    coordinates,
    contactEmail,
    contactPhone,
    website,
    logo,
    coverImage,
  } = req.body;

  const organization = await Organization.create({
    name,
    slug,
    description,
    type,
    address,
    governorate,
    city,
    location: {
      type: "Point",
      coordinates: assertCoordinates(coordinates),
    },
    contactEmail,
    contactPhone,
    website,
    logo,
    coverImage,
    createdBy: req.user._id,
  });

  return res.status(201).json({
    success: true,
    message: "Organization created successfully",
    data: organization,
  });
};

// PATCH /organizations/:id
// Admin, or an approved manager/building_admin of that organization.
export const updateOrganization = async (req, res) => {
  const { id } = req.params;
  const body = { ...req.body };

  if (!(await canManageOrganization(req.user, id))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit this organization",
    });
  }

  if (body.type) body.type = assertType(body.type);

  // `coordinates` is the client-facing shape; the model stores GeoJSON.
  if (body.coordinates) {
    body.location = {
      type: "Point",
      coordinates: assertCoordinates(body.coordinates),
    };
    delete body.coordinates;
  }

  // Retiring or restoring an organization is an admin-only move.
  if (body.isActive !== undefined) delete body.isActive;

  // Never let the client rewrite these through an update.
  delete body.createdBy;
  delete body.slug;

  const organization = await Organization.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });

  if (!organization) throw notFound("Organization not found");

  return res.status(200).json({
    success: true,
    message: "Organization updated successfully",
    data: organization,
  });
};

// Admin only. Soft delete, so historical bookings keep resolving.
export const deleteOrganization = async (req, res) => {
  const organization = await Organization.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!organization) throw notFound("Organization not found");

  // Hide its resources from browsing as well.
  await Resource.updateMany(
    { organization: organization._id },
    { $set: { isActive: false } }
  );

  return res.status(200).json({
    success: true,
    message: "Organization deleted successfully",
    data: { _id: organization._id, isActive: false },
  });
};

// =========================
// Read
// =========================

// GET /organizations
// Public. Honours its query params for the first time:
//   type, governorate, search, sort, page, limit, lat, lng, distance
export const getOrganizations = async (req, res) => {
  const { type, governorate, search, sort = "name" } = req.query;

  const point = readPoint(req.query);
  const filter = { isActive: true };

  if (type) filter.type = assertType(type);

  if (governorate) {
    filter.governorate = new RegExp(`^${escapeRegex(governorate)}$`, "i");
  }

  if (search) {
    // The text index only covers name + description, and OSM rows mostly
    // have an empty description, so match the name directly.
    filter.name = new RegExp(escapeRegex(search), "i");
  }

  const currentPage = readPage(req.query.page, 1);
  const perPage = readLimit(req.query.limit, 24);

  if (point) {
    // Near a position: nearest first, each row carries its distance.
    const distance = readDistance(req.query);

    const [result] = await Organization.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: point },
          distanceField: "distance",
          maxDistance: distance,
          spherical: true,
          query: filter,
        },
      },
      {
        $facet: {
          rows: [
            { $skip: (currentPage - 1) * perPage },
            { $limit: perPage },
          ],
          total: [{ $count: "value" }],
        },
      },
    ]);

    const rows = result?.rows ?? [];
    const total = result?.total?.[0]?.value ?? 0;

    return res.status(200).json({
      success: true,
      currentPage,
      totalPages: Math.ceil(total / perPage) || 1,
      totalItems: total,
      data: rows.map(({ distance, ...org }) => ({
        ...org,
        distanceMeters: Math.round(distance),
      })),
    });
  }

  const sortSpec = sort === "newest" ? { createdAt: -1 } : { name: 1 };

  const [data, total] = await Promise.all([
    Organization.find(filter)
      .sort(sortSpec)
      .skip((currentPage - 1) * perPage)
      .limit(perPage),
    Organization.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data,
  });
};

// GET /organizations/nearby?lat&lng&distance&type
// Kept for the original client's calling convention. Now paginated and each
// row carries distanceMeters, so the map can label markers.
export const getNearbyOrganizations = async (req, res) => {
  const { type } = req.query;

  const point = readPoint(req.query);
  if (!point) throw badRequest("lat and lng are required");

  const filter = { isActive: true };
  if (type) filter.type = assertType(type);

  const distance = readDistance(req.query);
  const currentPage = readPage(req.query.page, 1);
  const perPage = readLimit(req.query.limit, 50);

  const [result] = await Organization.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: point },
        distanceField: "distance",
        maxDistance: distance,
        spherical: true,
        query: filter,
      },
    },
    {
      $facet: {
        rows: [{ $skip: (currentPage - 1) * perPage }, { $limit: perPage }],
        total: [{ $count: "value" }],
      },
    },
  ]);

  const rows = result?.rows ?? [];
  const total = result?.total?.[0]?.value ?? 0;

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data: rows.map(({ distance, ...org }) => ({
      ...org,
      distanceMeters: Math.round(distance),
    })),
  });
};

// GET /organizations/categories?lat&lng&distance
// Drives the home screen: every category with its total count, how many are
// within reach, the nearest one's distance, and the options inside it.
export const getCategoryOverview = async (req, res) => {
  const point = readPoint(req.query);
  const distance = readDistance(req.query);

  const counts = new Map();
  const nearest = new Map();

  if (point) {
    const rows = await Organization.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: point },
          distanceField: "distance",
          maxDistance: distance,
          spherical: true,
          query: { isActive: true },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          nearest: { $min: "$distance" },
        },
      },
    ]);

    rows.forEach((row) => {
      counts.set(row._id, row.count);
      nearest.set(row._id, row.nearest);
    });
  } else {
    const rows = await Organization.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    rows.forEach((row) => counts.set(row._id, row.count));
  }

  const categories = describeAllOrganizationTypes()
    .map((described) => ({
      key: described.key,
      singular: described.singular,
      plural: described.plural,
      icon: described.icon,
      description: described.description,
      options: described.optionDetails,
      total: counts.get(described.key) ?? 0,
      nearbyCount: point ? counts.get(described.key) ?? 0 : null,
      nearestMeters: point
        ? Math.round(nearest.get(described.key) ?? Number.POSITIVE_INFINITY)
        : null,
    }))
    .map((category) =>
      category.nearestMeters === Number.POSITIVE_INFINITY
        ? { ...category, nearestMeters: null }
        : category
    );

  return res.status(200).json({
    success: true,
    data: {
      withinDistance: point ? distance : null,
      categories,
    },
  });
};

// GET /organizations/meta/types
// Static description of every category and its options. No DB, no auth.
export const getOrganizationTypes = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: describeAllOrganizationTypes(),
  });
};

// GET /organizations/:id
// Adds the type's options plus a resource summary so the detail screen
// renders in one call.
export const getOrganizationById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Organization not found");
  }

  const organization = await Organization.findById(id)
    .populate("createdBy", "firstName lastName email role")
    .lean();

  if (!organization) throw notFound("Organization not found");

  const described = describeOrganizationType(organization.type);

  const [resourceCount, availableCount] = await Promise.all([
    Resource.countDocuments({ organization: organization._id, isActive: true }),
    Resource.countDocuments({
      organization: organization._id,
      isActive: true,
      status: "available",
    }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      ...organization,
      typeLabel: described?.singular ?? organization.type,
      // The choices offered once someone opens this organization.
      options: described?.optionDetails ?? [],
      resourceCount,
      availableCount,
    },
  });
};

// GET /organizations/:id/resources
export const getOrganizationResources = async (req, res) => {
  const { id } = req.params;
  const { type, status } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Organization not found");
  }

  const filter = { organization: id, isActive: true };

  if (type) filter.type = assertResourceType(type);
  if (status) filter.status = String(status).toLowerCase();

  const currentPage = readPage(req.query.page, 1);
  const perPage = readLimit(req.query.limit, 50);

  const [data, total] = await Promise.all([
    Resource.find(filter)
      .sort({ type: 1, name: 1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    Resource.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    currentPage,
    totalPages: Math.ceil(total / perPage) || 1,
    totalItems: total,
    data,
  });
};

// GET /organizations/manageable
// Staff: the organizations this user is allowed to edit.
export const getManageableOrganizations = async (req, res) => {
  const scope = await organizationScope(req.user);

  const filter =
    scope === null
      ? { isActive: true }
      : { isActive: true, _id: { $in: scope } };

  const data = await Organization.find(filter).sort({ name: 1 }).lean();

  return res.status(200).json({
    success: true,
    data,
  });
};

// GET /organizations/members/:id  (admin or that organization's manager)
export const getOrganizationMembers = async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  if (!(await canManageOrganization(req.user, id))) {
    return res.status(403).json({
      success: false,
      message:
        "You do not have permission to view this organization's members",
    });
  }

  const filter = { organization: id };
  if (status) filter.status = String(status).toLowerCase();

  const data = await OrganizationMembership.find(filter)
    .populate("user", "firstName lastName email phone role")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data });
};

// GET /organizations/pending-requests  (admin)
export const getPendingMembershipRequests = async (req, res) => {
  const data = await OrganizationMembership.find({ status: "pending" })
    .populate("user", "firstName lastName email")
    .populate("organization", "name type slug")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data });
};

// PATCH /organizations/:id/memberships/:membershipId
// Admin or that organization's manager decides a pending request.
export const decideMembershipRequest = async (req, res) => {
  const { id, membershipId } = req.params;
  const { decision, note } = req.body;

  if (!["approved", "rejected"].includes(decision)) {
    throw badRequest('decision must be "approved" or "rejected"');
  }

  if (!(await canManageOrganization(req.user, id))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to manage this organization",
    });
  }

  const membership = await OrganizationMembership.findOneAndUpdate(
    { _id: membershipId, organization: id, status: "pending" },
    {
      status: decision,
      ...(decision === "approved" ? { joinedAt: new Date() } : {}),
      decisionNote: note ?? "",
    },
    { new: true }
  )
    .populate("organization", "name type")
    .lean();

  if (!membership) {
    throw notFound("Pending membership request not found");
  }

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
      note: note ?? "",
    },
  });

  return res.status(200).json({
    success: true,
    message:
      decision === "approved" ? "Membership approved" : "Membership rejected",
    data: membership,
  });
};
