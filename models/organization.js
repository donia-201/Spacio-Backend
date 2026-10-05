import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    // =========================
    // Basic Information
    // =========================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // Organization Type
    // =========================

    type: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,

      enum: [
        "hospital",
        "workspace",
        "building",
        "government",
        "company",
        "university",
        "school",
        "library",
        "bank",
        "other",
      ],
    },

    // =========================
    // Address
    // =========================

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

    // =========================
    // Location
    // GeoJSON
    // [longitude, latitude]
    // =========================

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

    // =========================
    // Contact Information
    // =========================

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // Images
    // =========================

    logo: {
      type: String,
      default: "",
    },

    coverImage: {
      type: String,
      default: "",
    },

    // =========================
    // External API Information
    // =========================

    source: {
      type: String,

      enum: [
        "openstreetmap",
        "google_places",
        "manual",
      ],

      default: "manual",
    },

    externalId: {
      type: String,
      default: "",
    },

    // =========================
    // Status
    // =========================

    isActive: {
      type: Boolean,
      default: true,
    },

    // =========================
    // Creator
    // =========================

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

// =========================
// Indexes
// =========================

// Filter by organization type
organizationSchema.index({
  type: 1,
});

// Filter by governorate
organizationSchema.index({
  governorate: 1,
});

// Geospatial search
organizationSchema.index({
  location: "2dsphere",
});

// Text search
organizationSchema.index({
  name: "text",
  description: "text",
});

// Prevent duplicate external places
organizationSchema.index(
  {
    source: 1,
    externalId: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

const Organization =
  mongoose.models.Organization ||
  mongoose.model(
    "Organization",
    organizationSchema
  );

export default Organization;