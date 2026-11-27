/**
 * @module config/logger
 * @description Journalisation structuree (JSON) avec Winston.
 * - Toujours sur la sortie standard : Vercel et Docker collectent ce flux.
 * - En plus dans logs/error.log et logs/combined.log si LOG_TO_FILE=true
 *   (environnement Docker de preproduction, avec rotation par taille).
 */
const winston = require('winston');
const env = require('./env');

const transports = [new winston.transports.Console()];

if (env.LOG_TO_FILE) {
  const fileOptions = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', ...fileOptions }),
    new winston.transports.File({ filename: 'logs/combined.log', ...fileOptions }),
  );
}

/** Logger partage par toute l'application. */
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  silent: env.NODE_ENV === 'test',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'taskapp-api', env: env.APP_ENV },
  transports,
});

module.exports = logger;
