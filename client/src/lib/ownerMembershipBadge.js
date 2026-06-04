/**
 * Membership badge label + Tailwind classes for owner search cards.
 */
export function getMembershipBadgeMeta(user) {
  if (!user) {
    return { label: 'Unknown', className: 'bg-gray-600 text-gray-200 border-gray-500/40' };
  }
  if (user.hasLifetimeSub) {
    return {
      label: 'Lifetime',
      className:
        'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border border-yellow-400/50 shadow-sm shadow-yellow-500/20',
    };
  }
  const tier = String(user.membershipTier || 'free').toLowerCase();
  if (tier === 'pro') {
    return {
      label: 'Pro',
      className:
        'bg-gradient-to-r from-indigo-500 to-violet-600 text-white border border-indigo-400/50 shadow-sm shadow-indigo-500/20',
    };
  }
  if (tier === 'premium' || user.isPremium) {
    return {
      label: 'Premium',
      className:
        'bg-gradient-to-r from-purple-500 to-pink-500 text-white border border-purple-400/50 shadow-sm shadow-purple-500/20',
    };
  }
  return {
    label: 'Free',
    className: 'bg-slate-600 text-slate-100 border border-slate-500/50',
  };
}
