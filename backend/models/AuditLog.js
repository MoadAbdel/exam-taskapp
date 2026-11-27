/**
 * @module models/AuditLog
 * @description Piste d'audit persistante : un document par evenement de securite.
 * Les logs de la plateforme ne sont gardes que peu de temps ; cette collection garde
 * l'historique 90 jours (index TTL) et se consulte avec `npm run audit:report`.
 */
const mongoose = require('mongoose');

/** Duree de conservation des evenements (90 jours). */
const RETENTION_SECONDS = 90 * 24 * 3600;

/**
 * @typedef {object} AuditLog
 * @property {string} event Type d'evenement (ex. `connexion_echec`).
 * @property {'info'|'warn'|'error'} level Gravite.
 * @property {string} [userId] Utilisateur concerne.
 * @property {string} [username] Nom saisi (utile pour les echecs de connexion).
 * @property {string} [ip] Adresse IP du client.
 * @property {string} [method] Methode HTTP.
 * @property {string} [path] Route appelee.
 * @property {number} [status] Code HTTP renvoye.
 * @property {string} [requestId] Identifiant de requete (meme valeur que dans les logs et l'en-tete X-Request-Id).
 * @property {object} [meta] Details complementaires (jamais de mot de passe ni de jeton).
 * @property {Date} createdAt Date de l'evenement.
 */
const AuditLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    userId: String,
    username: String,
    ip: String,
    method: String,
    path: String,
    status: Number,
    requestId: String,
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
AuditLogSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
module.exports.RETENTION_SECONDS = RETENTION_SECONDS;
