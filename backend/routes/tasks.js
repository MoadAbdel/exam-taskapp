/**
 * @module routes/tasks
 * @description CRUD des taches de l'utilisateur connecte. Base : /api/tasks
 *
 * Controle d'acces : chaque requete filtre sur `user: req.user.id`.
 * Une tache d'un autre utilisateur repond 404 (on ne revele pas son existence).
 */
const express = require('express');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const logger = require('../config/logger');

const router = express.Router();
router.use(auth);

/**
 * GET /api/tasks
 * @summary Liste les taches de l'utilisateur, les plus recentes d'abord.
 * @returns {200} Tableau de taches.
 */
router.get('/', async (req, res) => {
  const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(500).lean();
  res.json(tasks);
});

/**
 * POST /api/tasks
 * @summary Cree une tache.
 * @param {{title: string, description?: string}} req.body
 * @returns {201} La tache creee.
 * @returns {400} Titre vide, trop long ou contenant du HTML.
 */
router.post('/', validate(schemas.createTask), async (req, res) => {
  const { title, description } = req.body;
  const task = await Task.create({ title, description, user: req.user.id });
  res.status(201).json(task);
});

/**
 * PUT /api/tasks/:id
 * @summary Modifie une tache de l'utilisateur (mise a jour partielle).
 * @param {string} req.params.id Identifiant de la tache.
 * @param {{title?: string, description?: string, isCompleted?: boolean}} req.body
 * @returns {200} La tache modifiee.
 * @returns {404} Tache inexistante ou appartenant a un autre utilisateur.
 */
router.put('/:id', validate(schemas.objectIdParam, 'params'), validate(schemas.updateTask), async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
  );
  if (!task) return res.status(404).json({ msg: 'Tache introuvable.' });
  return res.json(task);
});

/**
 * DELETE /api/tasks/:id
 * @summary Supprime une tache de l'utilisateur.
 * @param {string} req.params.id Identifiant de la tache.
 * @returns {200} `{ msg }`
 * @returns {404} Tache inexistante ou appartenant a un autre utilisateur.
 */
router.delete('/:id', validate(schemas.objectIdParam, 'params'), async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!task) return res.status(404).json({ msg: 'Tache introuvable.' });
  logger.info('audit:tache_supprimee', { userId: req.user.id, taskId: req.params.id, requestId: req.id });
  return res.json({ msg: 'Tache supprimee.' });
});

module.exports = router;
