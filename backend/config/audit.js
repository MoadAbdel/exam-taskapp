/**
 * @module config/audit
 * @description Enregistre un evenement d'audit a deux endroits :
 * 1. le journal Winston (flux temps reel, logs Vercel / Docker) ;
 * 2. la collection MongoDB `auditlogs` (historique de 90 jours, interrogeable).
 * Une panne de la base ne bloque jamais la requete : l'evenement reste dans le journal.
 */
const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/** Gravite par defaut de chaque evenement. */
const LEVELS = {
  inscription: 'info',
  connexion: 'info',
  deconnexion: 'info',
  tache_supprimee: 'info',
  connexion_echec: 'warn',
  jeton_invalide: 'warn',
  limite_atteinte: 'warn',
  erreur_serveur: 'error',
};

/**
 * Enregistre un evenement d'audit.
 * @param {string} event Type d'evenement (cle de LEVELS).
 * @param {object} req Requete Express (IP, route, identifiant de requete, utilisateur).
 * @param {object} [details] Donnees supplementaires : userId, username, status, meta.
 * @returns {Promise<void>}
 * @example await audit('connexion_echec', req, { username, status: 401 });
 */
async function audit(event, req, details = {}) {
  const entry = {
    event,
    level: LEVELS[event] || 'info',
    userId: details.userId ?? req.user?.id,
    username: details.username,
    ip: req.ip,
    method: req.method,
    path: req.originalUrl?.split('?')[0],
    status: details.status,
    requestId: req.id,
    meta: details.meta,
  };
  logger.log(entry.level, `audit:${event}`, entry);
  try {
    await AuditLog.create(entry);
  } catch (err) {
    logger.error('audit non enregistre en base', { event, requestId: req.id, error: err.message });
  }
}

module.exports = { audit, LEVELS };
