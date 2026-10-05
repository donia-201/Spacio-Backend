import mongoose from "mongoose";

import { RESOURCE_TYPE_KEYS } from "../config/domain.js";

const resourceSchema = new mongoose.Schema(
  {
    // Basic information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Resource category — one of the `options` of the owning
    // organization's type. Enum mirrors config/domain.js RESOURCE_TYPES.
    type: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      enum: RESOURCE_TYPE_KEYS,
    },
    // Organization that owns/manages the resource
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
    },

    // Location information
    address: {
      type: String,
      default: "",
      trim: true,
    },

    governorate: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    // GeoJSON location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
      },
    },

    // Capacity
    capacity: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Amenities
    amenities: [
      {
        type: String,
        trim: true,
      },
    ],

    // Booking settings
    requiresApproval: {
      type: Boolean,
      default: true,
    },

    // Current resource status
    status: {
      type: String,
      enum: [
        "available",
        "booked",
        "maintenance",
      ],
      default: "available",
    },

    // Soft delete. Resources are never hard-deleted so historical bookings
    // keep resolving their organization/name.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Optional free-form note explaining why a technician set maintenance.
    statusNote: {
      type: String,
      default: "",
      trim: true,
    },

    // Optional information from external APIs
    image: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    workingHours: {
      type: String,
      default: "",
    },

    // Where the resource came from
    source: {
      type: String,
      enum: [
        "openstreetmap",
        "google_places",
        "manual",
      ],
      default: "manual",
    },

// External ID from OSM / Google. Left undefined rather than "" so the
// sparse unique index below actually skips manually created resources —
// an empty string is a real value, so every manual row would collide.
externalId: {
      type: String,
      default: undefined,
    },

    // User who created the resource
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Search resources by organization and type
resourceSchema.index({
  organization: 1,
  type: 1,
});

// Geospatial index
resourceSchema.index({
  location: "2dsphere",
});

// Search by governorate
resourceSchema.index({
  governorate: 1,
});

// Search by type
resourceSchema.index({
  type: 1,
});

// Prevent duplicate external resources
resourceSchema.index(
  {
    source: 1,
    externalId: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

const Resource =
  mongoose.models.Resource ||
  mongoose.model("Resource", resourceSchema);

export default Resource;