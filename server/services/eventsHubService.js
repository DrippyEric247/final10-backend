/**
 * Universal Events Hub — aggregates all live events for one client surface.
 */

const { WEEKEND_MULTIPLIER } = require('../config/points');
const { EVENT_TYPES, SCHEDULED_PLACEHOLDERS } = require('../config/universalEventsRegistry');
const { SCOUT_SUPPORT_MILESTONES, nextMilestoneAfter } = require('../config/scoutSupportConfig');
const { getActiveDropForUser } = require('./supplyDropService');
const { getActiveSavvySale } = require('./savvySaleService');
const { buildStatus } = require('./scoutSupportService');
const { getEggExchangeStatus } = require('./eggExchangeService');
const { applyTierEventMultiplier } = require('../lib/pointsEventMultipliers');

function msUntilEndOfUtcDay(date = new Date()) {
  const end = new Date(date);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(0, end.getTime() - date.getTime());
}

function isWeekendUtc(date = new Date()) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function weekendDoublePointsActive() {
  return isWeekendUtc() && Number(WEEKEND_MULTIPLIER) >= 1;
}

function eventCard(base) {
  return {
    id: base.id,
    type: base.type,
    status: base.status,
    title: base.title,
    icon: base.icon || '🎪',
    description: base.description || '',
    msRemaining: base.msRemaining ?? null,
    expiresAt: base.expiresAt ?? null,
    startsAt: base.startsAt ?? null,
    timerLabel: base.timerLabel ?? null,
    claimable: Boolean(base.claimable),
    ctaLabel: base.ctaLabel ?? null,
    ctaPath: base.ctaPath ?? null,
    claimAction: base.claimAction ?? null,
    meta: base.meta ?? {},
  };
}

function buildWeekendDoublePointsCard(user) {
  if (!weekendDoublePointsActive()) return null;
  const tier = user?.subscription?.tier || user?.membershipTier || 'free';
  const mult = applyTierEventMultiplier(2, tier);
  return eventCard({
    id: 'weekend_double_points',
    type: EVENT_TYPES.DOUBLE_POINTS,
    status: 'active',
    title: 'Double Points Weekend',
    icon: '🔥',
    description: `Earn ${mult}× Savvy on eligible rewards through Sunday UTC.`,
    msRemaining: msUntilEndOfUtcDay(),
    timerLabel: 'Ends in',
    claimable: false,
    ctaLabel: 'Earn Savvy',
    ctaPath: '/daily-streak',
    meta: { multiplier: mult },
  });
}

function buildSupplyDropCards(drop) {
  if (!drop || drop.expired) return { active: null, claimable: null };
  if (drop.alreadyClaimed) return { active: null, claimable: null };

  const base = {
    id: `supply_drop_${drop.dropId}`,
    type: EVENT_TYPES.SUPPLY_DROP,
    title: 'Max Supply Drop',
    icon: '📦',
    description: 'Savvy Scout intercepted a reward crate. Claim before it expires.',
    msRemaining: drop.msRemaining,
    expiresAt: drop.expiresAt,
    timerLabel: 'Expires in',
    claimAction: { type: 'supply_drop', dropId: drop.dropId },
    meta: { dropId: drop.dropId, scope: drop.scope },
  };

  return {
    active: eventCard({ ...base, status: 'active', claimable: true, ctaLabel: 'Claim Drop', ctaPath: '/events' }),
    claimable: eventCard({ ...base, status: 'claimable', claimable: true, ctaLabel: 'Claim Supply Drop', ctaPath: '/events' }),
  };
}

function buildSavvySaleCard(sale) {
  if (!sale?.active) return null;
  return eventCard({
    id: `savvy_sale_${sale.eventId}`,
    type: EVENT_TYPES.SAVVY_SALE,
    status: 'active',
    title: 'Savvy Sale',
    icon: '🔥',
    description: 'Emergency Perk Machine pricing — all paid spins cost 10 Savvy.',
    msRemaining: sale.msRemaining,
    expiresAt: sale.expiresAt,
    timerLabel: 'Sale ends in',
    claimable: false,
    ctaLabel: 'Open Perk Machine',
    ctaPath: '/perk-machine',
    meta: { saleSpinCost: sale.saleSpinCost },
  });
}

function buildScoutSupportCards(scoutStatus) {
  const cards = { active: [], claimable: [], upcoming: [] };

  if (!scoutStatus) return cards;

  cards.active.push(
    eventCard({
      id: 'scout_support_progress',
      type: EVENT_TYPES.SCOUT_SUPPORT,
      status: 'active',
      title: 'Scout Support',
      icon: '🛰️',
      description: scoutStatus.nextMilestone
        ? `${scoutStatus.progressCurrent}/${scoutStatus.progressTotal} toward ${scoutStatus.nextMilestone.label}`
        : `${scoutStatus.dealStreakCount} deals tracked this cycle`,
      claimable: false,
      ctaLabel: 'View Progress',
      ctaPath: '/events',
      meta: {
        dealStreakCount: scoutStatus.dealStreakCount,
        progressCurrent: scoutStatus.progressCurrent,
        progressTotal: scoutStatus.progressTotal,
      },
    })
  );

  for (const m of scoutStatus.milestonesReady || []) {
    cards.claimable.push(
      eventCard({
        id: `scout_milestone_${m.milestone}`,
        type: EVENT_TYPES.SCOUT_SUPPORT,
        status: 'claimable',
        title: `Scout Support — ${m.label}`,
        icon: m.icon || '🛰️',
        description: 'Milestone unlocked. Call in support to activate your reward.',
        claimable: true,
        ctaLabel: 'Call In Support',
        ctaPath: '/events',
        claimAction: { type: 'scout_milestone', milestone: m.milestone },
        meta: { milestone: m.milestone },
      })
    );
  }

  const next = scoutStatus.nextMilestone;
  if (next) {
    const remaining = Math.max(0, next.milestone - (scoutStatus.dealStreakCount || 0));
    cards.upcoming.push(
      eventCard({
        id: `scout_upcoming_${next.milestone}`,
        type: EVENT_TYPES.SCOUT_SUPPORT,
        status: 'upcoming',
        title: next.label,
        icon: next.icon || '🎁',
        description: next.description || `Unlock at ${next.milestone} deals.`,
        timerLabel: remaining > 0 ? `${remaining} deal${remaining === 1 ? '' : 's'} away` : 'Almost ready',
        claimable: false,
        meta: { milestone: next.milestone, dealsRemaining: remaining },
      })
    );
  }

  return cards;
}

function buildCompletedHistory(user, scoutStatus) {
  const rows = [];

  for (const entry of user.supplyDropClaimHistory || []) {
    rows.push({
      id: `history_drop_${entry.dropId}`,
      type: EVENT_TYPES.SUPPLY_DROP,
      title: entry.rewardLabel || 'Supply Drop',
      icon: '📦',
      claimedAt: entry.claimedAt,
      description: 'Max Supply Drop claimed',
    });
  }

  for (const milestone of scoutStatus?.milestonesClaimed || []) {
    const cfg = SCOUT_SUPPORT_MILESTONES.find((m) => m.milestone === milestone);
    rows.push({
      id: `history_scout_${milestone}`,
      type: EVENT_TYPES.SCOUT_SUPPORT,
      title: cfg?.label || `Scout Support Milestone ${milestone}`,
      icon: cfg?.icon || '🛰️',
      claimedAt: null,
      description: 'Scout Support milestone claimed',
    });
  }

  return rows.sort((a, b) => {
    const ta = a.claimedAt ? new Date(a.claimedAt).getTime() : 0;
    const tb = b.claimedAt ? new Date(b.claimedAt).getTime() : 0;
    return tb - ta;
  });
}

function buildUpcomingPlaceholders() {
  return SCHEDULED_PLACEHOLDERS.map((p) =>
    eventCard({
      id: p.id,
      type: p.type,
      status: 'upcoming',
      title: p.title,
      icon: p.icon,
      description: p.description,
      timerLabel: p.etaLabel,
      claimable: false,
    })
  );
}

async function buildEventsHub(user) {
  const [drop, sale] = await Promise.all([getActiveDropForUser(user._id), getActiveSavvySale()]);
  const scoutStatus = buildStatus(user);

  const activeEvents = [];
  const claimableRewards = [];
  const upcomingEvents = [];
  const completedHistory = buildCompletedHistory(user, scoutStatus);

  const dropCards = buildSupplyDropCards(drop);
  if (dropCards.active) activeEvents.push(dropCards.active);
  if (dropCards.claimable) claimableRewards.push(dropCards.claimable);

  const saleCard = buildSavvySaleCard(sale);
  if (saleCard) activeEvents.push(saleCard);

  const weekendCard = buildWeekendDoublePointsCard(user);
  if (weekendCard) activeEvents.push(weekendCard);

  const scoutCards = buildScoutSupportCards(scoutStatus);
  activeEvents.push(...scoutCards.active);
  claimableRewards.push(...scoutCards.claimable);
  upcomingEvents.push(...scoutCards.upcoming);
  upcomingEvents.push(...buildUpcomingPlaceholders());

  const eggExchange = getEggExchangeStatus(user);
  const mythic = eggExchange.mythicFusionProgress;
  if (mythic) {
    activeEvents.push(
      eventCard({
        id: 'mythic_fusion_progress',
        type: 'seasonal',
        status: mythic.canExchange ? 'claimable' : 'active',
        title: mythic.title,
        icon: '🥚',
        description: `${mythic.legendaryOwned}/${mythic.legendaryRequired} Legendary · ${mythic.savvyBalance.toLocaleString()}/${mythic.savvyRequired.toLocaleString()} Savvy`,
        timerLabel: `${mythic.progressPercent}% ready`,
        claimable: mythic.canExchange,
        ctaLabel: 'Open Egg Exchange',
        ctaPath: '/egg-exchange',
        meta: mythic,
      })
    );
  }

  const claimableCount = claimableRewards.length;

  return {
    claimableCount,
    activeEvents,
    claimableRewards,
    upcomingEvents,
    completedHistory,
    scoutSupport: scoutStatus,
    eggExchange: eggExchange.mythicFusionProgress,
    timers: {
      supplyDrop: drop && !drop.expired ? { msRemaining: drop.msRemaining, dropId: drop.dropId } : null,
      savvySale: sale?.active ? { msRemaining: sale.msRemaining, eventId: sale.eventId } : null,
    },
    raw: {
      supplyDrop: drop,
      savvySale: sale,
    },
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildEventsHub,
  weekendDoublePointsActive,
};
