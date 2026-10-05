import mongoose from "mongoose";

import Organization from "../models/organization.js";
import Resource from "../models/resource.js";
import notify from "../utils/notify.js";
import { badRequest, notFound } from "../utils/apiError.js";
import {
  canManageResource,
  organizationScope,
  ROLES,
} from "../utils/permissions.js";
import {
  optionsForType,
  RESOURCE_TYPES,
  RESOURCE_TYPE_KEYS,
} from "../config/domain.js";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readPage = (value, fallback = 1) => Math.max(1, Number(value) || fallback);

const readLimit = (value, fallback = 24) =>
  Math.min(Math.max(1, Number(value) || fallback), 100);

const assertResourceType = (value) => {
  const type = String(value).toLowerCase();
  if (!RESOURCE_TYPE_KEYS.includes(type)) {
    throw badRequest(`Unknown resource type "${value}"`);
  }
  return type;
};

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

const withLabel = (resource) => ({
  ...resource,
  typeLabel: RESOURCE_TYPES[resource.type] ?? resource.type,
});

// =========================
// Create / update / delete
// =========================

export const createResource = async (req, res) => {
  const { organization: organizationId, type, coordinates, ...rest } =
    req.body;

  const organization = await Organization.findById(organizationId);

  if (!organization) throw notFound("Organization not found");

  // A resource type must be one of the options offered by its
  // organization's category — this is what makes the category screens
  // meaningful.
  const allowed = optionsForType(organization.type);

  if (allowed && !allowed.includes(type)) {
    throw badRequest(
      `"${RESOURCE_TYPES[type] ?? type}" is not an option of a ${organization.type}. Allowed: ${allowed.join(", ")}`
    );
  }

  const [lng, lat] = coordinates ?? [];

  const resource = await Resource.create({
    ...rest,
    type,
    organization: organizationId,
    location: { type: "Point", coordinates: [lng, lat] },
    createdBy: req.user._id,
  });

  return res.status(201).json({
    success: true,
    message: "Resource created successfully",
    data: withLabel(resource.toObject()),
  });
};

// PATCH /resources/:id
// Admin, the technician who created it, or a manager of its organization.
export const updateResource = async (req, res) => {
  const { id } = req.params;

  const existing = await Resource.findById(id);

  if (!existing) throw notFound("Resource not found");

  if (!(await canManageResource(req.user, existing))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit this resource",
    });
  }

  const body = { ...req.body };

  if (body.type) {
    body.type = assertResourceType(body.type);
    const organization = await Organization.findById(
      existing.organization
    );
    const allowed = optionsForType(organization?.type);
    if (allowed && !allowed.includes(body.type)) {
      throw badRequest(
        `"${RESOURCE_TYPES[body.type]}" is not an option of a ${organization?.type}`
      );
    }
  }

  if (body.coordinates) {
    const [lng, lat] = body.coordinates;
    body.location = { type: "Point", coordinates: [lng, lat] };
    delete body.coordinates;
  }

  // A technician manages availability, not ownership or identity.
  if (req.user.role === ROLES.TECHNICIAN) {
    const technicianFields = [
      "status",
      "statusNote",
      "capacity",
      "amenities",
      "workingHours",
      "requiresApproval",
      "image",
      "phone",
      "isActive",
    ];
    Object.keys(body).forEach((key) => {
      if (!technicianFields.includes(key)) delete body[key];
    });
  }

  delete body.createdBy;
  delete body.organization;

  const resource = await Resource.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  });

  if (!resource) throw notFound("Resource not found");

  return res.status(200).json({
    success: true,
    message: "Resource updated successfully",
    data: withLabel(resource.toObject()),
  });
};

// Soft delete so historical bookings keep resolving.
export const deleteResource = async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) throw notFound("Resource not found");

  if (!(await canManageResource(req.user, resource))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete this resource",
    });
  }

  resource.isActive = false;
  await resource.save();

  return res.status(200).json({
    success: true,
    message: "Resource deleted successfully",
    data: { _id: resource._id, isActive: false },
  });
};

// PATCH /resources/:id/status
// The technician's main action: flip a resource in and out of maintenance.
export const updateResourceStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!["available", "booked", "maintenance"].includes(status)) {
    throw badRequest(
      'status must be "available", "booked" or "maintenance"'
    );
  }

  const resource = await Resource.findById(id);

  if (!resource) throw notFound("Resource not found");

  if (!(await canManageResource(req.user, resource))) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to change this resource's status",
    });
  }

  resource.status = status;
  resource.statusNote = note ?? "";
  await resource.save();

  // Tell the organization's managers, if any.
  if (note) {
    await notify({
      user: resource.createdBy,
      type: "resource_status_changed",
      data: { resourceId: resource._id, resourceName: resource.name, status },
    });
  }

  return res.status(200).json({
    success: true,
    message: `Resource marked as ${status}`,
    data: withLabel(resource.toObject()),
  });
};

// =========================
// Read
// =========================

// GET /resources
// Public. Now filters: organization, type, status, search, governorate,
// page, limit, and lat/lng + distance for a map view.
export const getResources = async (req, res) => {
  const { organization, type, status, search, governorate, includeInactive } =
    req.query;

  const filter = {};

  // Retired rows stay hidden unless staff ask for them.
  if (includeInactive === "true" && req.user) {
    filter.isActive = true;
  } else {
    filter.isActive = { $ne: false };
  }

  if (organization) filter.organization = organization;
  if (governorate) {
    filter.governorate = new RegExp(`^${escapeRegex(governorate)}$`, "i");
  }
  if (type) filter.type = assertResourceType(type);
  if (status) filter.status = String(status).toLowerCase();
  if (search) filter.name = new RegExp(escapeRegex(search), "i");

  const currentPage = readPage(req.query.page);
  const perPage = readLimit(req.query.limit);
  const point = readPoint(req.query);

  if (point) {
    const distance = readDistance(req.query);

    const [result] = await Resource.aggregate([
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
        $lookup: {
          from: "organizations",
          localField: "organization",
          foreignField: "_id",
          as: "organization",
        },
      },
      { $unwind: { path: "$organization", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          distance: 1,
          organization: {
            _id: 1,
            name: 1,
            type: 1,
            slug: 1,
          },
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
      data: rows.map(({ distance, ...row }) => ({
        ...withLabel(row),
        distanceMeters: Math.round(distance),
      })),
    });
  }

  const [data, total] = await Promise.all([
    Resource.find(filter)
      .populate("organization", "name type slug")
      .sort({ createdAt: -1 })
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
    data: data.map(withLabel),
  });
};

// GET /resources/manageable
// Staff: the resources this user is allowed to edit or change status on.
export const getManageableResources = async (req, res) => {
  if (req.user.role === ROLES.ADMIN) {
    const data = await Resource.find()
      .populate("organization", "name type slug")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: data.map(withLabel) });
  }

  const scope = await organizationScope(req.user);

  const filter = {
    $or: [
      { createdBy: req.user._id },
      ...(scope.length ? [{ organization: { $in: scope } }] : []),
    ],
  };

  const data = await Resource.find(filter)
    .populate("organization", "name type slug")
    .sort({ updatedAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data: data.map(withLabel) });
};

export const getResourceById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound("Resource not found");
  }

  const resource = await Resource.findById(id)
    .populate("organization", "name type slug governorate address")
    .lean();

  if (!resource || resource.isActive === false) {
    throw notFound("Resource not found");
  }

  return res.status(200).json({
    success: true,
    data: withLabel(resource),
  });
};
