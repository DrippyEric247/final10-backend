/** Normalize auth user id — API returns `id`; legacy paths may use `_id`. */
export function getReferralUserId(user) {
  if (!user) return null;
  const id = user.id ?? user._id;
  if (id == null || id === '') return null;
  return String(id);
}

export function makeReferralLink(userId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register?ref=${encodeURIComponent(userId)}`;
}

