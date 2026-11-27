/**
 * @module middleware/auth
 * @description Authentification par JWT stocke dans un cookie httpOnly.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Nom du cookie de session. */
const COOKIE_NAME = 'token';

/**
 * Options du cookie de session.
 * - httpOnly : JavaScript ne peut pas lire le jeton (protection XSS).
 * - secure : envoye seulement en HTTPS en production.
 * - sameSite strict : non envoye par un site tiers (protection CSRF).
 * @type {import('express').CookieOptions}
 */
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api',
  maxAge: 60 * 60 * 1000,
};

/**
 * Signe un jeton pour un utilisateur.
 * @param {string} userId Identifiant MongoDB de l'utilisateur.
 * @returns {string} JWT signe en HS256.
 */
function signToken(userId) {
  return jwt.sign({ user: { id: userId } }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Middleware : refuse la requete (401) sans jeton valide.
 * En cas de succes, `req.user.id` contient l'identifiant de l'utilisateur.
 * @type {import('express').RequestHandler}
 */
function auth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ msg: 'Authentification requise.' });
  }
  try {
    // L'algorithme est impose : un jeton "alg: none" ou RS256 est refuse.
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded.user;
    return next();
  } catch {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    return res.status(401).json({ msg: 'Session expiree ou invalide. Reconnectez-vous.' });
  }
}

module.exports = { auth, signToken, cookieOptions, COOKIE_NAME };
