function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} rawQuery
 * @returns {{ $or: { email: RegExp; username: RegExp }[] }}
 */
function buildOwnerUserRegexFilter(rawQuery) {
  const query = String(rawQuery || '').trim();
  const regex = new RegExp(escapeRegExp(query), 'i');
  return {
    $or: [{ email: regex }, { username: regex }],
  };
}

module.exports = {
  escapeRegExp,
  buildOwnerUserRegexFilter,
};
