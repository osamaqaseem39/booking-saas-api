import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('postgres'),
  DB_NAME: Joi.string().default('backend_saas'),
  DB_SSL: Joi.string().valid('true', 'false').default('true'),
  REDIS_HOST: Joi.string().default('redis'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': `"JWT_ACCESS_SECRET" is required in production`,
    }),
    otherwise: Joi.string().default('dev-enterprise-jwt-access-secret'),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().messages({
      'any.required': `"JWT_REFRESH_SECRET" is required in production`,
    }),
    otherwise: Joi.string().default('dev-enterprise-jwt-refresh-secret'),
  }),
  JWT_ACCESS_TTL: Joi.string().default('7d'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
});
