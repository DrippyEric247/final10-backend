import { parseApiError } from './apiErrorParsing';

const SPIN_FAIL_MESSAGE = 'Spin failed — no Savvy was spent. Try again.';

function isGenericSpinFailure(parsed) {
  const msg = String(parsed.message || '').trim();
  if (!parsed.status) return true;
  if (parsed.status >= 500) return true;
  return /request could not be completed|internal server error|network error|service is temporarily unavailable/i.test(
    msg
  );
}

/**
 * User-safe Perk Machine spin error copy.
 * @param {unknown} e
 * @param {{ showAdminDetail?: boolean }} opts
 */
export function formatPerkMachineSpinError(e, { showAdminDetail = false } = {}) {
  const parsed = parseApiError(e);
  if (parsed.code === 'INSUFFICIENT_SAVVY') {
    return parsed.message || 'Not enough Savvy for this spin.';
  }
  if (parsed.code === 'RATE_LIMITED' || parsed.status === 429) {
    return parsed.message || 'Too many spins — wait a moment and try again.';
  }
  if (isGenericSpinFailure(parsed)) {
    const detail = parsed.message || e?.message || '';
    if (showAdminDetail && detail && detail !== SPIN_FAIL_MESSAGE) {
      return `${SPIN_FAIL_MESSAGE} (${detail}${parsed.status ? ` · ${parsed.status}` : ''})`;
    }
    return SPIN_FAIL_MESSAGE;
  }
  return parsed.message || SPIN_FAIL_MESSAGE;
}

export { SPIN_FAIL_MESSAGE };
