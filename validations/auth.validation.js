import Joi from "joi";

export const signupSchema = Joi.object({
  firstName: Joi.string().min(3).max(30).trim().required(),

  lastName: Joi.string().min(3).max(30).trim().required(),

  email: Joi.string().email().required(),

  password: Joi.string().min(8).required(),

  phone: Joi.string().trim().allow("", null).optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().required(),
});

export const changePassSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

// Sent from the browser right after the geolocation prompt is answered.
export const locationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  governorate: Joi.string().trim().allow("", null).optional(),
  city: Joi.string().trim().allow("", null).optional(),
  // "denied" leaves the saved position untouched and just stops the prompt.
  permission: Joi.string().valid("granted", "denied").default("granted"),
});

export const searchRadiusSchema = Joi.object({
  radius: Joi.number().min(100).max(100000).required(),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(3).max(30).trim().optional(),
  lastName: Joi.string().min(3).max(30).trim().optional(),
  phone: Joi.string().trim().allow("", null).optional(),
  profileImage: Joi.object({
    secure_url: Joi.string().uri().required(),
    public_id: Joi.string().required(),
  })
    .unknown(false)
    .optional(),
});

export const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid("user", "technician", "admin").required(),
  isActive: Joi.boolean().optional(),
});
