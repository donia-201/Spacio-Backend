import Joi from "joi";

export const createOrganizationSchema =
  Joi.object({
    name: Joi.string().required(),

    slug: Joi.string().required(),

    description: Joi.string(),

    type: Joi.string().required(),

    address: Joi.string().required(),

    contactEmail: Joi.string().email(),

    contactPhone: Joi.string(),

    logo: Joi.string(),

    coverImage: Joi.string(),

    coordinates: Joi.array()
      .items(Joi.number())
      .length(2)
      .required(),
  });