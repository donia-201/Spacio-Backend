import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Declared as a real subdocument rather than a nested path on purpose: a
// nested path with a `default` on `type` materialises as `{ type: "Point" }`
// with no coordinates, and the 2dsphere index then rejects every insert.
// `default: undefined` keeps the field absent until the user actually shares
// a position.
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },

    // GeoJSON order: [longitude, latitude]
    coordinates: {
      type: [Number],
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    phone: String,

    profileImage: {
      secure_url: String,
      public_id: String,
    },

    // =========================
    // Role
    // user       -> browse + book
    // technician -> manage resource status of what they own
    // admin      -> full platform management
    // =========================
    role: {
      type: String,
      enum: ["user", "technician", "admin"],
      default: "user",
      index: true,
    },

    // =========================
    // Location
    // The client asks the browser for geolocation after signup; until it
    // does, `locationPermission` stays "pending" and the user keeps seeing
    // the "allow location" prompt.
    // =========================
    locationPermission: {
      type: String,
      enum: ["pending", "granted", "denied"],
      default: "pending",
    },

    location: {
      type: pointSchema,
      default: undefined,
    },

    governorate: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    // Distance (metres) the user is willing to see results for.
    searchRadius: {
      type: Number,
      default: 5000,
      min: 100,
      max: 100000,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

// Geospatial search on the user's saved position.
userSchema.index({ location: "2dsphere" });

// Hash password before saving user
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
