/**
 * @module middleware/validate
 * @description Valide une partie de la requete avec un schema Joi.
 */

/**
 * Cree un middleware de validation.
 * La valeur nettoyee (trim, conversion de types) remplace la valeur d'origine.
 * @param {object} schema Schema Joi.
 * @param {'body'|'params'|'query'} [source='body'] Partie de la requete a valider.
 * @returns {function}
 * @example router.post('/', validate(schemas.createTask), handler)
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source] ?? {}, {
      abortEarly: false,
      stripUnknown: false,
      convert: true,
    });
    if (error) {
      if (source === 'params') return res.status(404).json({ msg: 'Ressource introuvable.' });
      return res.status(400).json({
        msg: error.details[0].message,
        errors: error.details.map((d) => ({ field: d.path.join('.'), msg: d.message })),
      });
    }
    // Express 5 : req.query est en lecture seule, on stocke la valeur validee a part.
    req.validated = { ...(req.validated || {}), [source]: value };
    if (source === 'body') req.body = value;
    return next();
  };
}

module.exports = validate;
