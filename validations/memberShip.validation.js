import Joi from "joi";

export const MEMBERSHIP_ROLES = [
  "resident",
  "employee",
  "manager",
  "building_admin",
  "doctor",
  "teacher",
  "member",
];

export const MEMBERSHIP_STATUSES = ["pending", "approved", "rejected"];

// POST /memberships/join
export const joinOrganizationSchema = Joi.object({
  organizationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/, "must be a valid id")
    .required(),

  role: Joi.string()
    .valid(...MEMBERSHIP_ROLES)
    .default("member"),
});

// GET /memberships/my-organizations?status=
export const membershipStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...MEMBERSHIP_STATUSES)
    .default("pending"),
});

// PATCH /memberships/approve/:id and /reject/:id
export const membershipDecisionSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow("", null).optional(),
});
