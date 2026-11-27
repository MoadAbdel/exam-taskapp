/**
 * @module validators/schemas
 * @description Schemas Joi des donnees entrantes. Tout champ inconnu est refuse.
 */
const Joi = require('joi');

// Refuse les chevrons : aucun balisage HTML ne doit entrer en base (defense en profondeur contre le XSS).
const noHtml = /^[^<>]*$/;

const username = Joi.string()
  .trim()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_.-]+$/)
  .required()
  .messages({
    'string.pattern.base': "Le nom d'utilisateur accepte lettres, chiffres, point, tiret et souligne.",
    'string.min': "Le nom d'utilisateur doit contenir au moins 3 caracteres.",
    'string.max': "Le nom d'utilisateur doit contenir au plus 30 caracteres.",
    'string.empty': "Le nom d'utilisateur est obligatoire.",
    'any.required': "Le nom d'utilisateur est obligatoire.",
  });

/** Inscription : mot de passe de 8 a 72 caracteres (72 = limite de bcrypt) avec lettre et chiffre. */
const register = Joi.object({
  username,
  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/[a-zA-Z]/)
    .pattern(/[0-9]/)
    .required()
    .messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caracteres.',
      'string.max': 'Le mot de passe doit contenir au plus 72 caracteres.',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
      'string.empty': 'Le mot de passe est obligatoire.',
      'any.required': 'Le mot de passe est obligatoire.',
    }),
});

/** Connexion : on verifie seulement la forme (des chaines), pas la politique de mot de passe. */
const login = Joi.object({
  username: Joi.string().trim().max(30).required().messages({
    'string.empty': "Le nom d'utilisateur est obligatoire.",
    'any.required': "Le nom d'utilisateur est obligatoire.",
  }),
  password: Joi.string().max(72).required().messages({
    'string.empty': 'Le mot de passe est obligatoire.',
    'any.required': 'Le mot de passe est obligatoire.',
  }),
});

const title = Joi.string().trim().min(1).max(200).pattern(noHtml).messages({
  'string.empty': 'Le titre est obligatoire.',
  'string.max': 'Le titre doit contenir au plus 200 caracteres.',
  'string.pattern.base': 'Le titre ne doit pas contenir les caracteres < ou >.',
  'any.required': 'Le titre est obligatoire.',
});
const description = Joi.string().trim().max(1000).allow('').pattern(noHtml).messages({
  'string.max': 'La description doit contenir au plus 1000 caracteres.',
  'string.pattern.base': 'La description ne doit pas contenir les caracteres < ou >.',
});

/** Creation de tache. */
const createTask = Joi.object({ title: title.required(), description });

/** Mise a jour partielle : au moins un champ. */
const updateTask = Joi.object({ title, description, isCompleted: Joi.boolean() })
  .min(1)
  .messages({ 'object.min': 'Aucune modification fournie.' });

/** Identifiant MongoDB (24 caracteres hexadecimaux). */
const objectIdParam = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

module.exports = { register, login, createTask, updateTask, objectIdParam };
