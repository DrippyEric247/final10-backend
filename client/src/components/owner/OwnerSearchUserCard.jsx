import React from 'react';
import {
  User,
  Ban,
  Gift,
  Crown,
  Eye,
  Calendar,
  Hash,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { getMembershipBadgeMeta } from '../../lib/ownerMembershipBadge';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function formatNum(value) {
  return Number(value || 0).toLocaleString();
}

export default function OwnerSearchUserCard({
  user,
  onGrantSavvy,
  onEditMembership,
  onBanUser,
  onUnbanUser,
  onViewProfile,
}) {
  const badge = getMembershipBadgeMeta(user);
  const banned = Boolean(user.isBanned);

  return (
    <article
      className={`rounded-xl border bg-gray-800/90 p-5 shadow-lg transition-all hover:border-yellow-500/30 ${
        banned ? 'border-red-500/40 opacity-90' : 'border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <User className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-lg font-semibold text-white">{user.username || '—'}</h4>
            <p className="truncate text-sm text-gray-400">{user.email}</p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-gray-500">
            <Hash className="h-3 w-3" /> User ID
          </dt>
          <dd className="mt-1 truncate font-mono text-xs text-gray-200" title={user.id}>
            {user.id}
          </dd>
        </div>
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" /> Joined
          </dt>
          <dd className="mt-1 text-white">
            {formatDate(user.accountCreatedAt || user.memberSince)}
          </dd>
        </div>
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-gray-500">
            <ShoppingBag className="h-3 w-3" /> Purchases
          </dt>
          <dd className="mt-1 font-semibold text-white">{formatNum(user.totalPurchases)}</dd>
        </div>
        <div className="rounded-lg bg-gray-900/60 px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-gray-500">
            <Sparkles className="h-3 w-3" /> Savvy earned
          </dt>
          <dd className="mt-1 font-semibold text-emerald-300">
            {formatNum(user.totalSavvyEarned ?? user.lifetimePointsEarned ?? user.savvyPoints)}
          </dd>
        </div>
      </dl>

      {(user.betaTester || user.foundingAccess) && (
        <span className="mt-3 inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
          Founding Tester
        </span>
      )}
      {banned && (
        <span className="mt-3 ml-2 inline-flex rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-200">
          Banned
        </span>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onViewProfile(user)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
        >
          <Eye className="h-3.5 w-3.5" />
          View Full Profile
        </button>
        <button
          type="button"
          onClick={() => onGrantSavvy(user)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Gift className="h-3.5 w-3.5" />
          Grant Savvy
        </button>
        <button
          type="button"
          onClick={() => onEditMembership(user)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
        >
          <Crown className="h-3.5 w-3.5" />
          Edit Membership
        </button>
        {banned ? (
          <button
            type="button"
            onClick={() => onUnbanUser(user)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-500 bg-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-600"
          >
            Unban
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBanUser(user)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
          >
            <Ban className="h-3.5 w-3.5" />
            Ban User
          </button>
        )}
      </div>
    </article>
  );
}
