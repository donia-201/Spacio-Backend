import Joi from "joi";

export const createBookingSchema =
  Joi.object({
    resource:
      Joi.string().required(),

    organization:
      Joi.string().required(),

    startTime:
      Joi.date().required(),

    endTime:
      Joi.date().required(),

    notes:
      Joi.string(),
  });