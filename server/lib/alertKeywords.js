/**
 * Normalize alert keywords into AND tokens (each must appear in listing title).
 * Splits phrases like "iPhone 13 unlocked" → ["iPhone", "13", "unlocked"].
 */
function normalizeAlertKeywords(keywords) {
  const input = Array.isArray(keywords) ? keywords : [];
  const flat = [];
  for (const raw of input) {
    const s = String(raw || '').trim();
    if (!s) continue;
    for (const token of s.split(/[\s,]+/)) {
      const t = token.trim();
      if (t) flat.push(t);
    }
  }
  const seen = new Set();
  const out = [];
  for (const k of flat) {
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out.slice(0, 12);
}

module.exports = { normalizeAlertKeywords };
