/**
 * @module routes/account
 * @description Droits des personnes (RGPD). Base : /api/account
 * - export des donnees : droits d'acces et de portabilite (articles 15 et 20) ;
 * - suppression du compte : droit a l'effacement (article 17).
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const User = require('../models/User');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');
const { auth, cookieOptions, COOKIE_NAME } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { audit } = require('../config/audit');

const router = express.Router();
router.use(auth);

const confirmSchema = Joi.object({
  password: Joi.string().max(72).required().messages({
    'any.required': 'Le mot de passe est obligatoire.',
    'string.empty': 'Le mot de passe est obligatoire.',
  }),
});

/**
 * GET /api/account/export
 * @summary Telecharge toutes les donnees personnelles du compte (JSON).
 * @returns {200} `{ exportedAt, account, tasks, securityEvents }` en piece jointe.
 */
router.get('/export', async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ msg: 'Compte introuvable.' });
  const tasks = await Task.find({ user: req.user.id }).lean();
  const securityEvents = await AuditLog.find({ userId: req.user.id })
    .select('-_id event ip method path status createdAt')
    .lean();
  await audit('export_donnees', req, { status: 200 });
  res.set('Content-Disposition', 'attachment; filename="mes-donnees.json"').set('Cache-Control', 'no-store');
  return res.json({
    exportedAt: new Date().toISOString(),
    account: { username: user.username, createdAt: user.createdAt },
    tasks: tasks.map(({ title, description, isCompleted, createdAt, updatedAt }) => ({
      title,
      description,
      isCompleted,
      createdAt,
      updatedAt,
    })),
    securityEvents,
  });
});

/**
 * DELETE /api/account
 * @summary Supprime le compte et ses taches ; anonymise la piste d'audit. Mot de passe exige.
 * @param {{password: string}} req.body
 * @returns {204} Compte supprime.
 * @returns {403} Mot de passe incorrect.
 */
router.delete('/', validate(confirmSchema), async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  if (!user) return res.status(401).json({ msg: 'Compte introuvable.' });
  if (!(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(403).json({ msg: 'Mot de passe incorrect.' });
  }
  await Task.deleteMany({ user: user._id });
  await user.deleteOne();
  // Les evenements restent (securite) mais ne permettent plus d'identifier la personne.
  await AuditLog.updateMany(
    { $or: [{ userId: req.user.id }, { username: user.username }] },
    { $unset: { userId: 1, username: 1, ip: 1 } },
    { sanitizeFilter: false },
  );
  req.user = undefined;
  await audit('compte_supprime', { id: req.id, method: req.method, originalUrl: req.originalUrl }, { status: 204 });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  return res.status(204).end();
});

module.exports = router;
