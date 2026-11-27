/**
 * @module config/db
 * @description Connexion MongoDB via Mongoose.
 * La connexion est mise en cache : en serverless (Vercel), une meme instance
 * de fonction traite plusieurs requetes et ne doit pas ouvrir une connexion par requete.
 */
const mongoose = require('mongoose');
const debug = require('debug')('app:db');
const logger = require('./logger');

// Les filtres de requete construits a partir d'objets utilisateur ne peuvent plus
// contenir d'operateurs ($ne, $gt...) : protection contre l'injection NoSQL.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

/** @type {?Promise} */
let connecting = null;

/**
 * Ouvre la connexion (une seule fois) et la renvoie.
 * @param {string} uri Chaine de connexion MongoDB.
 * @returns {Promise<object>}
 */
function connectDB(uri) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  if (!connecting) {
    debug('ouverture de la connexion');
    connecting = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 })
      .then((m) => {
        logger.info('MongoDB connecte', { host: m.connection.host });
        return m;
      })
      .catch((err) => {
        connecting = null; // la prochaine requete retentera
        logger.error('Connexion MongoDB impossible', { error: err.message });
        throw err;
      });
  }
  return connecting;
}

/**
 * Ferme la connexion (tests, arret propre du conteneur).
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  connecting = null;
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
