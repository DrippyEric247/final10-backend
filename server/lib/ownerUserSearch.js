const mongoose = require('mongoose');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidObjectIdString(value) {
  const s = String(value || '').trim();
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return false;
  return String(new mongoose.Types.ObjectId(s)) === s;
}

/**
 * Safe user search — escaped regex on email/username; _id only when valid ObjectId.
 * @param {string} rawQuery
 * @returns {{ $or: object[] }}
 */
function buildOwnerUserSearchFilter(rawQuery) {
  const query = String(rawQuery || '').trim();
  const emailLower = query.toLowerCase();
  const pattern = escapeRegExp(query);
  const regex = new RegExp(pattern, 'i');

  const or = [
    { username: regex },
    { email: regex },
    { email: emailLower },
  ];

  if (isValidObjectIdString(query)) {
    or.push({ _id: new mongoose.Types.ObjectId(query) });
  }

  return { $or: or };
}

module.exports = {
  escapeRegExp,
  isValidObjectIdString,
  buildOwnerUserSearchFilter,
};
