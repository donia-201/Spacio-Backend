import Joi from "joi";

export const createResourceSchema =
  Joi.object({
    name: Joi.string().required(),

    description: Joi.string(),

    type: Joi.string()
      .valid(
        "meeting_room",
        "workspace",
        "parking",
        "lab",
        "classroom"
      )
      .required(),

    organization: Joi.string().required(),

    capacity: Joi.number(),

    amenities: Joi.array(),

    requiresApproval: Joi.boolean(),
  });