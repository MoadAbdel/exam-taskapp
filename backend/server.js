/**
 * @module server
 * @description Point d'entree hors Vercel (poste local, conteneur Docker).
 * Ouvre la base, ecoute le port et gere l'arret propre (SIGTERM envoye par Docker).
 */
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  logger.info(`API demarree sur le port ${env.PORT}`, { env: env.APP_ENV });
  connectDB(env.MONGO_URI).catch(() => {
    /* deja journalise : l'API repond 503 tant que la base est absente */
  });
});

/**
 * Arret propre : finit les requetes en cours puis ferme la base.
 * @param {string} signal
 */
function shutdown(signal) {
  logger.info(`Signal ${signal} recu, arret en cours`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetee non geree', { reason: String(reason) });
});
