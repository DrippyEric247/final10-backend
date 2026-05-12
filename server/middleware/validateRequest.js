const Joi = require('joi');
const { HttpError } = require('./apiErrors');

function formatJoiMessage(error) {
  return error.details.map((d) => d.message.replace(/"/g, '')).join('; ');
}

/**
 * @param {Joi.ObjectSchema} schema
 * @param {'body'|'query'} source
 */
function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const value = source === 'query' ? req.query : req.body;
    const { error, value: normalized } = schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(new HttpError(400, 'VALIDATION_ERROR', formatJoiMessage(error)));
    }
    if (source === 'query') {
      Object.assign(req.query, normalized);
      req.validatedQuery = normalized;
    } else {
      Object.assign(req.body, normalized);
      req.validatedBody = normalized;
    }
    next();
  };
}

module.exports = { validateRequest };
