/**
 * @module routes/auth
 * @description Inscription, connexion, deconnexion et profil courant.
 * Base : /api/auth
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { auth, signToken, cookieOptions, COOKIE_NAME } = require('../middleware/auth');
const { audit } = require('../config/audit');

const router = express.Router();

// Hash calcule une fois : compare() s'execute aussi quand l'utilisateur n'existe pas,
// la duree de reponse ne revele donc pas si un compte existe.
const DUMMY_HASH = bcrypt.hashSync('compte-inexistant', 12);

// Limite les essais de mot de passe : 10 tentatives par 15 minutes et par IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Le blocage est trace : une suite de blocages depuis une meme IP signale une attaque par force brute.
  handler: async (req, res, _next, options) => {
    await audit('limite_atteinte', req, { username: req.body?.username, status: options.statusCode });
    res.status(options.statusCode).json({ msg: 'Trop de tentatives. Reessayez dans 15 minutes.' });
  },
});

/**
 * POST /api/auth/register
 * @summary Cree un compte puis ouvre la session.
 * @param {{username: string, password: string}} req.body
 * @returns {201} `{ user: { _id, username } }` et cookie de session httpOnly.
 * @returns {400} Donnees invalides (message explicite).
 * @returns {409} Nom d'utilisateur deja pris.
 */
router.post('/register', authLimiter, validate(schemas.register), async (req, res) => {
  const { username, password } = req.body;

  const exists = await User.exists({ username });
  if (exists) {
    return res.status(409).json({ msg: "Ce nom d'utilisateur est deja pris." });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, password: hash });
  await audit('inscription', req, { userId: user.id, username, status: 201 });

  res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions);
  return res.status(201).json({ user: { _id: user.id, username: user.username } });
});

/**
 * POST /api/auth/login
 * @summary Verifie les identifiants et ouvre la session.
 * @param {{username: string, password: string}} req.body
 * @returns {200} `{ user: { _id, username } }` et cookie de session httpOnly.
 * @returns {401} Identifiants incorrects (message volontairement identique dans les deux cas).
 * @returns {429} Trop de tentatives.
 */
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select('+password');
  const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

  if (!user || !isMatch) {
    await audit('connexion_echec', req, { username, status: 401, meta: { compteExiste: !!user } });
    return res.status(401).json({ msg: "Nom d'utilisateur ou mot de passe incorrect." });
  }

  await audit('connexion', req, { userId: user.id, username, status: 200 });
  res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions);
  return res.json({ user: { _id: user.id, username: user.username } });
});

/**
 * POST /api/auth/logout
 * @summary Ferme la session (supprime le cookie).
 * @returns {204}
 */
router.post('/logout', async (req, res) => {
  if (req.cookies?.[COOKIE_NAME]) await audit('deconnexion', req, { status: 204 });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  return res.status(204).end();
});

/**
 * GET /api/auth/me
 * @summary Renvoie l'utilisateur connecte. Sert au frontend a savoir si la session est active.
 * @returns {200} `{ user: { _id, username } }`
 * @returns {401} Pas de session valide.
 */
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ msg: 'Compte introuvable.' });
  return res.json({ user: { _id: user.id, username: user.username } });
});

module.exports = router;
