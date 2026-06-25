// client/src/lib/passwordStrength.js
/** Client-side password strength hints (signup + reset). Min 10 chars matches server Joi. */
export function scorePasswordStrength(password) {
  const p = String(password || '');
  if (!p) return { score: 0, label: '', checks: [] };

  const checks = [
    { id: 'length', label: 'At least 10 characters', ok: p.length >= 10 },
    { id: 'lower', label: 'Lowercase letter', ok: /[a-z]/.test(p) },
    { id: 'upper', label: 'Uppercase letter', ok: /[A-Z]/.test(p) },
    { id: 'number', label: 'Number', ok: /\d/.test(p) },
    { id: 'special', label: 'Special character', ok: /[^A-Za-z0-9]/.test(p) },
  ];

  const passed = checks.filter((c) => c.ok).length;
  let label = 'Weak';
  let score = 1;
  if (passed >= 3 && p.length >= 10) {
    label = 'Fair';
    score = 2;
  }
  if (passed >= 4 && p.length >= 12) {
    label = 'Strong';
    score = 3;
  }
  if (passed >= 5 && p.length >= 14) {
    label = 'Excellent';
    score = 4;
  }

  return { score, label, checks };
}

export function isPasswordStrongEnough(password) {
  const p = String(password || '');
  return p.length >= 10;
}
