import Joi from "joi";

export const createBookingSchema = Joi.object({
  resource: Joi.string().required(),

  organization: Joi.string().required(),

  startTime: Joi.date().iso().required(),

  endTime: Joi.date().iso().required(),

  notes: Joi.string().trim().max(1000).allow("", null).optional(),
})
  .custom((value, helpers) => {
    // The server never checked this, so a backwards range was accepted.
    if (new Date(value.endTime) <= new Date(value.startTime)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "endTime must be after startTime",
  });

// Approve / reject both take an optional note shown to the requester.
export const bookingDecisionSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow("", null).optional(),
});
