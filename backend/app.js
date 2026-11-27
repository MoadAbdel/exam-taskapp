/**
 * @module app
 * @description Application Express (sans ecoute reseau).
 * Exportee pour Vercel (fonction serverless), pour server.js (Docker / local) et pour les tests.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB } = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const { audit } = require('./config/audit');
const { register, metricsMiddleware } = require('./config/metrics');

const app = express();

// Derriere le proxy de Vercel ou de nginx : l'IP client vient de X-Forwarded-For.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// En-tetes de securite (HSTS, nosniff, CSP stricte pour une API JSON...).
app.use(helmet());

// CORS : meme origine par defaut. Seules les origines listees dans CORS_ORIGINS sont acceptees.
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
    credentials: true,
  }),
);

app.use(express.json({ limit: '10kb' })); // limite la taille des corps : anti deni de service
app.use(cookieParser());
app.use(requestLogger);
app.use(metricsMiddleware);

/**
 * GET /metrics
 * @summary Metriques Prometheus (format texte). Actif seulement si METRICS_ENABLED=true.
 * Hors du prefixe /api : ni nginx ni Vercel ne l'exposent sur Internet, seul Prometheus le lit
 * sur le reseau interne. Si METRICS_TOKEN est defini, un en-tete `Authorization: Bearer` est exige.
 * @returns {200} Metriques au format texte Prometheus.
 * @returns {401} Jeton absent ou incorrect.
 * @returns {404} Metriques desactivees.
 */
app.get('/metrics', async (req, res) => {
  if (!env.METRICS_ENABLED) return res.status(404).json({ msg: 'Route introuvable.' });
  if (env.METRICS_TOKEN && req.get('authorization') !== `Bearer ${env.METRICS_TOKEN}`) {
    return res.status(401).json({ msg: 'Jeton de metriques requis.' });
  }
  res.set('Content-Type', register.contentType);
  return res.send(await register.metrics());
});

/**
 * GET /api/health
 * @summary Sonde de supervision : etat de l'API et de la base.
 * @returns {200} `{ status: 'ok', db: 'up', env, version, uptime }`
 * @returns {503} Base de donnees injoignable.
 */
app.get('/api/health', async (req, res) => {
  const base = {
    env: env.APP_ENV,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.VERCEL_DEPLOYMENT_ID || 'local',
  };
  try {
    await connectDB(env.MONGO_URI);
    await mongoose.connection.db.admin().ping();
    res
      .set('Cache-Control', 'no-store')
      .json({ status: 'ok', db: 'up', ...base, uptime: Math.round(process.uptime()) });
  } catch {
    res
      .status(503)
      .set('Cache-Control', 'no-store')
      .json({ status: 'degraded', db: 'down', ...base });
  }
});

// Toutes les autres routes de l'API ont besoin de la base.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB(env.MONGO_URI);
    next();
  } catch {
    res.status(503).json({ msg: 'Service temporairement indisponible.' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/account', require('./routes/account'));

// Route inconnue.
app.use((req, res) => res.status(404).json({ msg: 'Route introuvable.' }));

// Gestionnaire d'erreurs. Express 5 transmet aussi les erreurs des fonctions async.
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ msg: 'JSON invalide.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ msg: 'Requete trop volumineuse.' });
  if (err.code === 11000) return res.status(409).json({ msg: 'Cette valeur existe deja.' });
  logger.error('erreur non geree', { requestId: req.id, error: err.message, stack: err.stack });
  // Trace d'audit : on retrouve l'erreur avec le requestId communique a l'utilisateur.
  await audit('erreur_serveur', req, { status: 500, meta: { error: err.message } });
  // Pas de detail technique vers le client.
  return res.status(500).json({ msg: 'Erreur interne du serveur.', requestId: req.id });
});

module.exports = app;
