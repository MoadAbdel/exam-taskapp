/**
 * @module config/env
 * @description Lit et valide la configuration au demarrage.
 * L'application refuse de demarrer si un secret manque ou est trop faible
 * (validation des configurations, defense en profondeur).
 */
require('dotenv').config({ quiet: true });
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  MONGO_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  // 32 caracteres minimum : un secret court se casse par force brute hors ligne.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  // Liste d'origines separees par des virgules. Vide = meme origine uniquement.
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('http'),
  LOG_TO_FILE: Joi.boolean().default(false),
  // Nom de l'environnement affiche par /api/health (preprod, production...).
  APP_ENV: Joi.string().default(Joi.ref('NODE_ENV')),
  // Endpoint /metrics (Prometheus). Desactive par defaut ; jeton Bearer optionnel pour le proteger.
  METRICS_ENABLED: Joi.boolean().default(false),
  METRICS_TOKEN: Joi.string().min(16).allow('').default(''),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  throw new Error(`Configuration invalide : ${error.details.map((d) => d.message).join(', ')}`);
}

/**
 * Configuration validee et typee.
 * @type {{NODE_ENV: string, PORT: number, MONGO_URI: string, JWT_SECRET: string,
 *   JWT_EXPIRES_IN: string, CORS_ORIGINS: string[], LOG_LEVEL: string,
 *   LOG_TO_FILE: boolean, APP_ENV: string, isProd: boolean}}
 */
module.exports = {
  ...value,
  CORS_ORIGINS: value.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: value.NODE_ENV === 'production',
};
