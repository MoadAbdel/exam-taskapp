/**
 * @module config/metrics
 * @description Metriques Prometheus de l'API (format texte standard, lu par Prometheus ou Grafana Agent).
 * - http_requests_total : requetes par methode, route et code HTTP ;
 * - http_request_duration_seconds : latence (histogramme, permet le p95) ;
 * - security_events_total : evenements d'audit (connexions, echecs, blocages...) ;
 * - mongodb_up : 1 si la base est connectee ;
 * - metriques Node.js (memoire, CPU, boucle d'evenements).
 * Les routes sont etiquetees par leur modele (`/api/tasks/:id`), jamais par l'URL brute :
 * le nombre de series reste borne.
 */
const client = require('prom-client');
const mongoose = require('mongoose');

const register = new client.Registry();
register.setDefaultLabels({ service: 'taskapp-api', env: process.env.APP_ENV || process.env.NODE_ENV || 'dev' });
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Requetes HTTP traitees',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duree de traitement des requetes HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const securityEvents = new client.Counter({
  name: 'security_events_total',
  help: "Evenements d'audit de securite",
  labelNames: ['event'],
  registers: [register],
});

new client.Gauge({
  name: 'mongodb_up',
  help: 'Etat de la connexion MongoDB (1 = connectee)',
  registers: [register],
  collect() {
    this.set(mongoose.connection.readyState === 1 ? 1 : 0);
  },
});

/**
 * Middleware : mesure chaque requete de l'API.
 * @type {function}
 */
function metricsMiddleware(req, res, next) {
  // Les collectes de Prometheus elles-memes ne sont pas du trafic applicatif.
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // Modele de route (ex. /api/tasks/:id) ; "inconnue" pour les 404 de routage.
    const route = req.route ? `${req.baseUrl}${req.route.path === '/' ? '' : req.route.path}` || '/' : 'inconnue';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

module.exports = { register, metricsMiddleware, securityEvents };
