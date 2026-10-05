import Joi from "joi";

import { RESOURCE_TYPE_KEYS } from "../config/domain.js";

export const createResourceSchema = Joi.object({
  name: Joi.string().trim().required(),

  type: Joi.string()
    .lowercase()
    .valid(...RESOURCE_TYPE_KEYS)
    .required(),

  organization: Joi.string().required(),

  description: Joi.string().trim().allow("", null).optional(),

  // The model requires governorate + location.coordinates. The old Joi
  // schema rejected both as unknown keys, so POST /resources could never
  // succeed. They are now first-class fields.
  governorate: Joi.string().trim().required(),

  coordinates: Joi.array().items(Joi.number()).length(2).required(),

  city: Joi.string().trim().allow("", null).optional(),

  address: Joi.string().trim().allow("", null).optional(),

  capacity: Joi.number().integer().min(1).optional(),

  amenities: Joi.array().items(Joi.string().trim()).optional(),

  requiresApproval: Joi.boolean().optional(),

  status: Joi.string()
    .valid("available", "booked", "maintenance")
    .optional(),

  image: Joi.string().uri().allow("", null).optional(),

  phone: Joi.string().trim().allow("", null).optional(),

  workingHours: Joi.string().trim().allow("", null).optional(),
});

export const updateResourceSchema = Joi.object({
  name: Joi.string().trim().min(2).optional(),

  type: Joi.string()
    .lowercase()
    .valid(...RESOURCE_TYPE_KEYS)
    .optional(),

  description: Joi.string().trim().optional(),

  address: Joi.string().trim().optional(),

  governorate: Joi.string().trim().optional(),

  city: Joi.string().trim().optional(),

  coordinates: Joi.array().items(Joi.number()).length(2).optional(),

  capacity: Joi.number().integer().min(1).optional(),

  amenities: Joi.array().items(Joi.string().trim()).optional(),

  requiresApproval: Joi.boolean().optional(),

  status: Joi.string()
    .valid("available", "booked", "maintenance")
    .optional(),

  statusNote: Joi.string().trim().allow("", null).optional(),

  image: Joi.string().uri().allow("", null).optional(),

  phone: Joi.string().trim().optional(),

  workingHours: Joi.string().trim().optional(),

  isActive: Joi.boolean().optional(),
}).min(1);
