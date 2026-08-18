/**
 * Wave 6 — lightweight per-user normalization markers.
 */

const DATA_NORMALIZATION_VERSION = 1;

function buildNormalizationPatch(source, flags = []) {
  return {
    'dataNormalization.version': DATA_NORMALIZATION_VERSION,
    'dataNormalization.lastRunAt': new Date(),
    'dataNormalization.source': String(source || 'manual'),
    'dataNormalization.flags': Array.isArray(flags) ? flags : [],
  };
}

function isUserNormalized(user, minVersion = DATA_NORMALIZATION_VERSION) {
  const v = Number(user?.dataNormalization?.version) || 0;
  return v >= minVersion;
}

module.exports = {
  DATA_NORMALIZATION_VERSION,
  buildNormalizationPatch,
  isUserNormalized,
};
