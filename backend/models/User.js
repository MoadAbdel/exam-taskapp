/**
 * @module models/User
 * @description Compte utilisateur. Le mot de passe est stocke uniquement sous forme de hash bcrypt.
 */
const mongoose = require('mongoose');

/**
 * @typedef {object} User
 * @property {string} username Identifiant unique (3 a 30 caracteres).
 * @property {string} password Hash bcrypt du mot de passe. Jamais renvoye par l'API.
 * @property {Date} createdAt
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
      select: false, // jamais lu par defaut : evite une fuite du hash
    },
  },
  { timestamps: true },
);

// Le hash ne sort jamais dans une reponse JSON.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
