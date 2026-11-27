/**
 * @module config/logger
 * @description Journalisation structuree (JSON) avec Winston.
 * - Toujours sur la sortie standard : Vercel et Docker collectent ce flux.
 * - En plus dans logs/error.log et logs/combined.log si LOG_TO_FILE=true
 *   (environnement Docker de preproduction, avec rotation par taille).
 * - En plus vers Grafana Loki si LOKI_URL est defini (preproduction et production sur Vercel) :
 *   historique, recherche, tableaux de bord et alertes dans Grafana Cloud.
 */
const winston = require('winston');
const env = require('./env');
const LokiTransport = require('./lokiTransport');

const transports = [new winston.transports.Console()];

if (env.LOG_TO_FILE) {
  const fileOptions = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', ...fileOptions }),
    new winston.transports.File({ filename: 'logs/combined.log', ...fileOptions }),
  );
}

/** @type {?LokiTransport} */
let loki = null;
if (env.LOKI_URL && env.NODE_ENV !== 'test') {
  loki = new LokiTransport({
    url: env.LOKI_URL,
    user: env.LOKI_USER,
    token: env.LOKI_TOKEN,
    labels: { service: 'taskapp-api', env: env.APP_ENV },
  });
  transports.push(loki);
  // Hors Vercel (processus long) : envoi periodique. Sur Vercel : envoi apres chaque requete (voir flushLogs).
  if (!process.env.VERCEL) setInterval(() => loki.flush(), 5000).unref();
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

/**
 * Envoie immediatement les logs en attente vers Loki (sans effet si Loki n'est pas configure).
 * @returns {Promise<void>}
 */
logger.flushLogs = () => (loki ? loki.flush() : Promise.resolve());

module.exports = logger;
