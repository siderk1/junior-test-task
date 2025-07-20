import * as Joi from "joi";

export const baseValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").required(),
  APP_PORT: Joi.number().port().required(),
  SERVICE_NAME: Joi.string().required(),
});
