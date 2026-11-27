/**
 * @module middleware/requestLogger
 * @description Journal d'acces : une ligne JSON par requete (methode, route, statut, duree, utilisateur).
 * Chaque requete recoit un identifiant (en-tete X-Request-Id) pour relier logs et erreurs.
 */
const { randomUUID } = require('node:crypto');
const logger = require('../config/logger');

/** @type {import('express').RequestHandler} */
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
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.id,
      ip: req.ip,
    });
  });
  next();
}

module.exports = requestLogger;
