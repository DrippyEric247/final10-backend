export function makeReferralLink(userId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register?ref=${encodeURIComponent(userId)}`;
}

