/** Maps Best Buy Open Box API condition strings to Final10 normalized conditions. */

const OPEN_BOX_CONDITION_MAP = {
  excellent: 'open_box_excellent',
  certified: 'open_box_excellent',
  good: 'open_box_good',
  fair: 'open_box_fair',
  poor: 'open_box_other',
};

function mapOpenBoxCondition(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (!key) return 'open_box_other';
  return OPEN_BOX_CONDITION_MAP[key] || 'open_box_other';
}

function openBoxConditionLabel(normalized) {
  switch (normalized) {
    case 'open_box_excellent':
      return 'Open Box — Excellent';
    case 'open_box_good':
      return 'Open Box — Good';
    case 'open_box_fair':
      return 'Open Box — Fair';
    default:
      return 'Open Box';
  }
}

module.exports = {
  OPEN_BOX_CONDITION_MAP,
  mapOpenBoxCondition,
  openBoxConditionLabel,
};
