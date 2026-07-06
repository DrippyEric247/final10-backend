/**
 * Perk Machine timed boosts + inventory activation.
 *
 * Activating a token consumes it and starts a timed boost (stored on
 * user.perkMachine.activeBoosts). Multipliers are read at grant time so the
 * effect is server-authoritative and visible everywhere.
 */

const BOOST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Items the player can activate from inventory. */
const ACTIVATABLE_ITEMS = Object.freeze({
  battlePassXp15: {
    key: 'battlePassXp15',
    kind: 'boost',
    source: 'tokens',
    label: '1.5× Battle Pass XP',
    icon: '⚡',
    multiplier: 1.5,
    durationMs: BOOST_DURATION_MS,
    effect: '1.5× Battle Pass XP for the next 24 hours.',
  },
  savvyMultiplier15: {
    key: 'savvyMultiplier15',
    kind: 'boost',
    source: 'tokens',
    label: '1.5× Savvy',
    icon: '✨',
    multiplier: 1.5,
    durationMs: BOOST_DURATION_MS,
    effect: '1.5× Savvy from Perk Machine rewards for the next 24 hours.',
  },
  extraFreeSpin: {
    key: 'extraFreeSpin',
    kind: 'free_spin',
    source: 'eggInventory',
    label: 'Extra Free Spin Egg',
    icon: '🎰',
    effect: 'Adds one free Perk Machine spin right now.',
  },
});

function ensureBoostDoc(user) {
  if (!user.perkMachine || typeof user.perkMachine !== 'object') user.perkMachine = {};
  const pm = user.perkMachine;
  if (!pm.activeBoosts || typeof pm.activeBoosts !== 'object') pm.activeBoosts = {};
  if (!pm.tokens || typeof pm.tokens !== 'object') pm.tokens = { battlePassXp15: 0, savvyMultiplier15: 0 };
  if (!pm.eggInventory || typeof pm.eggInventory !== 'object') pm.eggInventory = {};
  if (typeof pm.extraFreeSpins !== 'number') pm.extraFreeSpins = 0;
  return pm;
}

function isBoostActive(user, key) {
  const b = user?.perkMachine?.activeBoosts?.[key];
  if (!b || !b.expiresAt) return false;
  return new Date(b.expiresAt).getTime() > Date.now();
}

function getSavvyMultiplier(user) {
  return isBoostActive(user, 'savvyMultiplier15') ? ACTIVATABLE_ITEMS.savvyMultiplier15.multiplier : 1;
}

/** Labels + icons for personal timed events (activated from egg-hatch tokens). */
const PERSONAL_EVENTS = Object.freeze({
  doubleXp: { kind: 'doubleXp', label: 'Double XP', icon: '⚡', xpMultiplier: 2 },
  savvySale: { kind: 'savvySale', label: 'Savvy Sale', icon: '🏷️' },
});

function isPersonalEventActive(user, kind) {
  const e = user?.perkMachine?.personalEvents?.[kind];
  if (!e || !e.expiresAt) return false;
  return new Date(e.expiresAt).getTime() > Date.now();
}

function getBpXpMultiplier(user) {
  let mult = 1;
  if (isBoostActive(user, 'battlePassXp15')) {
    mult = Math.max(mult, ACTIVATABLE_ITEMS.battlePassXp15.multiplier);
  }
  if (isPersonalEventActive(user, 'doubleXp')) {
    mult = Math.max(mult, PERSONAL_EVENTS.doubleXp.xpMultiplier);
  }
  return mult;
}

function formatDurationLabel(ms) {
  const totalMin = Math.round((Number(ms) || 0) / 60000);
  if (totalMin >= 60) {
    const hours = Math.round(totalMin / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${totalMin} min`;
}

/** Owned (not-yet-activated) personal timed event tokens. */
function serializeTimedEventTokens(user) {
  const list = Array.isArray(user?.perkMachine?.timedEventTokens)
    ? user.perkMachine.timedEventTokens
    : [];
  return list.map((t) => ({
    id: t.id,
    kind: t.kind,
    label: t.label || PERSONAL_EVENTS[t.kind]?.label || 'Event Token',
    icon: t.icon || PERSONAL_EVENTS[t.kind]?.icon || '⏱️',
    durationMs: Number(t.durationMs) || 0,
    durationLabel: formatDurationLabel(t.durationMs),
  }));
}

/** Currently-running personal timed events. */
function serializePersonalEvents(user) {
  const events = user?.perkMachine?.personalEvents || {};
  const now = Date.now();
  const out = [];
  for (const [kind, val] of Object.entries(events)) {
    if (!val?.expiresAt) continue;
    const remainingMs = new Date(val.expiresAt).getTime() - now;
    if (remainingMs <= 0) continue;
    const def = PERSONAL_EVENTS[kind] || { label: kind, icon: '⏱️' };
    out.push({
      kind,
      label: def.label,
      icon: def.icon,
      activatedAt: val.activatedAt || null,
      expiresAt: val.expiresAt,
      remainingMs,
    });
  }
  return out.sort((a, b) => a.remainingMs - b.remainingMs);
}

/**
 * Activate a personal timed-event token by id. Consumes the token and starts
 * (or extends) the matching personal event window.
 */
function activatePersonalEventToken(user, tokenId) {
  const pm = ensureBoostDoc(user);
  if (!Array.isArray(pm.timedEventTokens)) pm.timedEventTokens = [];
  const idx = pm.timedEventTokens.findIndex((t) => String(t.id) === String(tokenId));
  if (idx === -1) {
    const err = new Error('That event token is not in your inventory.');
    err.status = 400;
    err.code = 'NO_TOKEN';
    throw err;
  }
  const token = pm.timedEventTokens[idx];
  const kind = token.kind;
  const durationMs = Number(token.durationMs) || 0;
  pm.timedEventTokens.splice(idx, 1);

  if (!pm.personalEvents || typeof pm.personalEvents !== 'object') pm.personalEvents = {};
  const now = Date.now();
  const existing = pm.personalEvents[kind];
  const base =
    existing && new Date(existing.expiresAt).getTime() > now
      ? new Date(existing.expiresAt).getTime()
      : now;
  pm.personalEvents[kind] = {
    activatedAt: existing?.activatedAt ? existing.activatedAt : new Date(now),
    expiresAt: new Date(base + durationMs),
  };
  user.markModified('perkMachine');

  const def = PERSONAL_EVENTS[kind] || { label: token.label || kind, icon: token.icon || '⏱️' };
  return {
    activated: true,
    item: { key: kind, label: token.label || def.label, icon: token.icon || def.icon },
    event: {
      kind,
      label: def.label,
      icon: def.icon,
      expiresAt: pm.personalEvents[kind].expiresAt,
    },
    user,
  };
}

/** Serialize currently active timed boosts (for the Active Boosts panel). */
function serializeActiveBoosts(user) {
  const out = [];
  const boosts = user?.perkMachine?.activeBoosts || {};
  const now = Date.now();
  for (const [key, val] of Object.entries(boosts)) {
    const def = ACTIVATABLE_ITEMS[key];
    if (!def || !val?.expiresAt) continue;
    const remainingMs = new Date(val.expiresAt).getTime() - now;
    if (remainingMs <= 0) continue;
    out.push({
      key,
      label: def.label,
      icon: def.icon,
      multiplier: def.multiplier || null,
      activatedAt: val.activatedAt || null,
      expiresAt: val.expiresAt,
      remainingMs,
    });
  }
  return out.sort((a, b) => a.remainingMs - b.remainingMs);
}

/**
 * Activate an inventory item. Returns { activated, item, boost?, user }.
 * Throws Error with .status/.code on validation failures.
 */
function activatePerkItem(user, itemKey) {
  const def = ACTIVATABLE_ITEMS[String(itemKey || '')];
  if (!def) {
    const err = new Error('That item cannot be activated.');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }
  const pm = ensureBoostDoc(user);

  if (def.kind === 'boost') {
    const have = Number(pm.tokens?.[def.key]) || 0;
    if (have < 1) {
      const err = new Error(`You don't have a ${def.label} token to activate.`);
      err.status = 400;
      err.code = 'NO_TOKEN';
      throw err;
    }
    pm.tokens[def.key] = have - 1;
    const now = Date.now();
    const existing = pm.activeBoosts?.[def.key];
    const base = existing && new Date(existing.expiresAt).getTime() > now
      ? new Date(existing.expiresAt).getTime()
      : now;
    pm.activeBoosts = {
      ...pm.activeBoosts,
      [def.key]: {
        activatedAt: existing?.activatedAt ? existing.activatedAt : new Date(now),
        expiresAt: new Date(base + def.durationMs),
      },
    };
    user.markModified('perkMachine');
    return {
      activated: true,
      item: { key: def.key, label: def.label, icon: def.icon, effect: def.effect },
      boost: {
        key: def.key,
        label: def.label,
        icon: def.icon,
        expiresAt: pm.activeBoosts[def.key].expiresAt,
        multiplier: def.multiplier,
      },
      user,
    };
  }

  if (def.kind === 'free_spin') {
    const have = Number(pm.eggInventory?.extraFreeSpin) || 0;
    if (have < 1) {
      const err = new Error('You have no Extra Free Spin eggs to activate.');
      err.status = 400;
      err.code = 'NO_EGG';
      throw err;
    }
    pm.eggInventory.extraFreeSpin = have - 1;
    pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
    user.markModified('perkMachine');
    return {
      activated: true,
      item: { key: def.key, label: def.label, icon: def.icon, effect: def.effect },
      freeSpins: 1,
      user,
    };
  }

  const err = new Error('That item cannot be activated.');
  err.status = 400;
  err.code = 'INVALID_ITEM';
  throw err;
}

module.exports = {
  BOOST_DURATION_MS,
  ACTIVATABLE_ITEMS,
  PERSONAL_EVENTS,
  isBoostActive,
  isPersonalEventActive,
  getSavvyMultiplier,
  getBpXpMultiplier,
  serializeActiveBoosts,
  serializeTimedEventTokens,
  serializePersonalEvents,
  activatePerkItem,
  activatePersonalEventToken,
};
