import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri().optional(),
  SOLANA_RPC_URL: Joi.string()
    .uri()
    .default('https://api.mainnet-beta.solana.com'),
  SOLANA_PRIORITY_RPC_URL: Joi.string().uri(),
  HELIUS_API_KEY: Joi.string(),
  SESSION_KEYS_ENABLED: Joi.boolean().default(false),
});

export const validationOptions = {
  allowUnknown: true,
  abortEarly: true,
};
