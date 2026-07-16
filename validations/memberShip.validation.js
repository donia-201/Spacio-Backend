import Joi from "joi";

export const joinOrganizationSchema =
  Joi.object({
    organizationId:
      Joi.string().required(),

    role:
      Joi.string().required(),
  });