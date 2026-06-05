import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMembershipBadgeLabel } from '../../lib/membershipSync';

export default function MembershipStatusBadge({ user: userProp, className = '' }) {
  const { user: authUser } = useAuth() || {};
  const user = userProp || authUser;
  const label = getMembershipBadgeLabel(user);

  if (!label) return null;

  const isPro = label === 'PRO ACTIVE';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${
        isPro
          ? 'border-violet-400/60 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-500/30'
          : 'border-purple-400/50 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm shadow-purple-500/20'
      } ${className}`}
    >
      {label}
    </span>
  );
}
