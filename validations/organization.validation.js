import Joi from "joi";

import { ORGANIZATION_TYPE_KEYS } from "../config/domain.js";

export const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().required(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .required(),

  type: Joi.string()
    .lowercase()
    .valid(...ORGANIZATION_TYPE_KEYS)
    .required(),

  description: Joi.string().trim().allow("", null).optional(),

  address: Joi.string().trim().required(),

  // The model requires this. It was missing from the old schema, which is
  // why POST /organizations always answered 500.
  governorate: Joi.string().trim().required(),

  city: Joi.string().trim().allow("", null).optional(),

  // GeoJSON order: [longitude, latitude]
  coordinates: Joi.array()
    .items(Joi.number())
    .length(2)
    .required(),

  contactEmail: Joi.string().email().allow("", null).optional(),

  contactPhone: Joi.string().trim().allow("", null).optional(),

  website: Joi.string().uri().allow("", null).optional(),

  logo: Joi.string().uri().allow("", null).optional(),

  coverImage: Joi.string().uri().allow("", null).optional(),
});

export const updateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).optional(),

  type: Joi.string()
    .lowercase()
    .valid(...ORGANIZATION_TYPE_KEYS)
    .optional(),

  description: Joi.string().trim().optional(),

  address: Joi.string().trim().optional(),

  governorate: Joi.string().trim().optional(),

  city: Joi.string().trim().optional(),

  coordinates: Joi.array().items(Joi.number()).length(2).optional(),

  contactEmail: Joi.string().email().allow("", null).optional(),

  contactPhone: Joi.string().trim().optional(),

  website: Joi.string().uri().allow("", null).optional(),

  logo: Joi.string().uri().allow("", null).optional(),

  coverImage: Joi.string().uri().allow("", null).optional(),

  isActive: Joi.boolean().optional(),
}).min(1);
