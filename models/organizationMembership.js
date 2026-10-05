import mongoose from "mongoose";

const organizationMembershipSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
      },

      role: {
        type: String,
        required: true,
        enum: [
          "resident",
          "employee",
          "manager",
          "building_admin",
          "doctor",
          "teacher",
          "member",
        ],
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
        ],
        default: "pending",
      },

      // Optional reason shown to the requester when a request is declined.
      decisionNote: {
        type: String,
        default: "",
        trim: true,
      },

      joinedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    }
  );

  organizationMembershipSchema.index({
  user: 1,
  organization: 1,
}, {
  unique: true,
});

organizationMembershipSchema.index({
  organization: 1,
  role: 1,
});

organizationMembershipSchema.index({
  user: 1,
});

const OrganizationMembership =
  mongoose.models
    .OrganizationMembership ||
  mongoose.model(
    "OrganizationMembership",
    organizationMembershipSchema
  );



export default OrganizationMembership;