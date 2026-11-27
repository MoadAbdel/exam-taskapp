/**
 * @module middleware/requestLogger
 * @description Journal d'acces : une ligne JSON par requete (methode, route, statut, duree, utilisateur).
 * Chaque requete recoit un identifiant (en-tete X-Request-Id) pour relier logs et erreurs.
 * Sur Vercel, les logs en attente partent vers Grafana Loki apres la reponse (waitUntil) :
 * l'utilisateur n'attend pas l'envoi.
 */
const { randomUUID } = require('node:crypto');
const { waitUntil } = require('@vercel/functions');
const logger = require('../config/logger');

/** @type {function} */
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.id = req.get('x-vercel-id') || randomUUID();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level, 'requete', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      // Modele de route (ex. /api/tasks/:id) : regroupement fiable dans Grafana.
      route: req.route ? `${req.baseUrl}${req.route.path === '/' ? '' : req.route.path}` || '/' : 'inconnue',
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.id,
      ip: req.ip,
    });
    if (process.env.VERCEL) waitUntil(logger.flushLogs());
  });
  next();
}

module.exports = requestLogger;
