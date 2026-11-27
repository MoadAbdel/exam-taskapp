/**
 * @module models/Task
 * @description Tache d'un utilisateur.
 */
const mongoose = require('mongoose');

/**
 * @typedef {object} Task
 * @property {ObjectId} user Proprietaire de la tache.
 * @property {string} title Titre (1 a 200 caracteres).
 * @property {string} [description] Description (1000 caracteres maximum).
 * @property {boolean} isCompleted Tache terminee ou non.
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */
const TaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // toutes les lectures filtrent par proprietaire
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TaskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Task', TaskSchema);
