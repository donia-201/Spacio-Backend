import Joi from "joi";

export const signupSchema = Joi.object({
  firstName: Joi.string().min(3).max(10).trim().required(),

  lastName: Joi.string().min(3).max(10).trim().required(),

  email: Joi.string().email().required(),

  password: Joi.string().min(8).required(),

  phone: Joi.string().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().required(),
});

export const changePassSchema= Joi.object({
    oldPassword: Joi.string().required(),
    newPassword : Joi.string().min(8).required()
});


