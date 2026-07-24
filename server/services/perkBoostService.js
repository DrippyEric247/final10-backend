/**
 * Perk Machine timed boosts + inventory activation.
 */

const {
  TOKEN_DURATION_MS,
  INVENTORY_TOKENS,
  resolveInventoryToken,
  tokenCountForUser,
  consumeTokenFromUser,
} = require('../config/inventoryTokens');

/** @deprecated use TOKEN_DURATION_MS */
const BOOST_DURATION_MS = TOKEN_DURATION_MS;

/** Items the player can activate from inventory (legacy export). */
const ACTIVATABLE_ITEMS = Object.freeze(
  Object.fromEntries(
    Object.values(INVENTORY_TOKENS).map((def) => [
      def.itemKey,
      {
        key: def.itemKey,
        itemType: def.itemType,
        kind: def.kind,
        source: def.source,
        label: def.label,
        activeLabel: def.activeLabel || def.label,
        icon: def.icon,
        multiplier: def.multiplier || null,
        durationMs: def.durationMs || TOKEN_DURATION_MS,
        effect: def.confirmBody,
        navigationTarget: def.navigationTarget,
      },
    ])
  )
);

/** Legacy savvyMultiplier15 maps to savvy level XP token. */
ACTIVATABLE_ITEMS.savvyMultiplier15 = {
  ...ACTIVATABLE_ITEMS.savvyLevelXp15,
  key: 'savvyMultiplier15',
};

const PERSONAL_EVENTS = Object.freeze({
  doubleXp: { kind: 'doubleXp', label: 'Double XP', icon: '⚡', xpMultiplier: 2 },
  savvySale: { kind: 'savvySale', label: 'Savvy Sale', icon: '🏷️' },
});

function ensureBoostDoc(user) {
  if (!user.perkMachine || typeof user.perkMachine !== 'object') user.perkMachine = {};
  const pm = user.perkMachine;
  if (!pm.activeBoosts || typeof pm.activeBoosts !== 'object') pm.activeBoosts = {};
  if (!pm.tokens || typeof pm.tokens !== 'object') {
    pm.tokens = { battlePassXp15: 0, savvyLevelXp15: 0, savvyMultiplier15: 0 };
  }
  if (typeof pm.tokens.savvyLevelXp15 !== 'number') pm.tokens.savvyLevelXp15 = 0;
  if (!pm.eggInventory || typeof pm.eggInventory !== 'object') pm.eggInventory = {};
  if (typeof pm.extraFreeSpins !== 'number') pm.extraFreeSpins = 0;
  if (!Array.isArray(pm.inventoryTransactions)) pm.inventoryTransactions = [];
  return pm;
}

function isBoostActive(user, key) {
  const b = user?.perkMachine?.activeBoosts?.[key];
  if (!b || !b.expiresAt) return false;
  return new Date(b.expiresAt).getTime() > Date.now();
}

function isPersonalEventActive(user, kind) {
  const e = user?.perkMachine?.personalEvents?.[kind];
  if (!e || !e.expiresAt) return false;
  return new Date(e.expiresAt).getTime() > Date.now();
}

function getBpXpMultiplier(user) {
  let mult = 1;
  if (isBoostActive(user, 'battlePassXp15')) {
    mult = Math.max(mult, INVENTORY_TOKENS.battle_pass_xp_token.multiplier);
  }
  if (isPersonalEventActive(user, 'doubleXp')) {
    mult = Math.max(mult, PERSONAL_EVENTS.doubleXp.xpMultiplier);
  }
  return mult;
}

function getProfileXpMultiplier(user) {
  if (isBoostActive(user, 'savvyLevelXp15')) {
    return INVENTORY_TOKENS.savvy_level_xp_token.multiplier;
  }
  // Legacy boost key migration
  if (isBoostActive(user, 'savvyMultiplier15')) {
    return INVENTORY_TOKENS.savvy_level_xp_token.multiplier;
  }
  return 1;
}

/** @deprecated Savvy Level XP token no longer multiplies Savvy Points. */
function getSavvyMultiplier(_user) {
  return 1;
}

function formatDurationLabel(ms) {
  const totalMin = Math.round((Number(ms) || 0) / 60000);
  if (totalMin >= 60) {
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${totalMin} min`;
}

function formatRemainingMs(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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

function serializeActiveBoosts(user) {
  const out = [];
  const boosts = user?.perkMachine?.activeBoosts || {};
  const now = Date.now();
  for (const [key, val] of Object.entries(boosts)) {
    const def =
      Object.values(INVENTORY_TOKENS).find((t) => t.boostKey === key || t.itemKey === key) ||
      ACTIVATABLE_ITEMS[key];
    if (!def || !val?.expiresAt) continue;
    const remainingMs = new Date(val.expiresAt).getTime() - now;
    if (remainingMs <= 0) continue;
    out.push({
      key,
      type: def.boostKey || def.itemKey || key,
      itemType: def.itemType || null,
      label: def.activeLabel || def.label,
      icon: def.icon,
      multiplier: def.multiplier || null,
      activatedAt: val.activatedAt || null,
      expiresAt: val.expiresAt,
      remainingMs,
      remainingLabel: formatRemainingMs(remainingMs),
      extended: Boolean(val.extended),
    });
  }
  return out.sort((a, b) => a.remainingMs - b.remainingMs);
}

function activateTimedBoost(user, def, sourceInventoryItemId = null) {
  const pm = ensureBoostDoc(user);
  const boostKey = def.boostKey || def.itemKey;
  const now = Date.now();
  const existing = pm.activeBoosts?.[boostKey];
  const wasActive = existing && new Date(existing.expiresAt).getTime() > now;
  const base =
    wasActive ? new Date(existing.expiresAt).getTime() : now;
  pm.activeBoosts = {
    ...pm.activeBoosts,
    [boostKey]: {
      type: boostKey,
      multiplier: def.multiplier,
      activatedAt: wasActive ? existing.activatedAt : new Date(now),
      expiresAt: new Date(base + (def.durationMs || TOKEN_DURATION_MS)),
      source: 'inventory_token',
      sourceInventoryItemId: sourceInventoryItemId || def.itemType,
      status: 'active',
      extended: wasActive,
    },
  };
  // Remove legacy key if migrating
  if (boostKey === 'savvyLevelXp15' && pm.activeBoosts.savvyMultiplier15) {
    delete pm.activeBoosts.savvyMultiplier15;
  }
  user.markModified('perkMachine');
  return {
    type: boostKey,
    multiplier: def.multiplier,
    activatedAt: pm.activeBoosts[boostKey].activatedAt,
    expiresAt: pm.activeBoosts[boostKey].expiresAt,
    extended: wasActive,
  };
}

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

/**
 * Activate an inventory item by canonical itemType or legacy itemKey.
 */
function activatePerkItem(user, itemKeyOrType, opts = {}) {
  const def = resolveInventoryToken(itemKeyOrType);
  if (!def) {
    const err = new Error('That item cannot be activated.');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }
  const pm = ensureBoostDoc(user);
  const have = tokenCountForUser(user, def);
  if (have < 1) {
    const err = new Error(`You don't have a ${def.label} to activate.`);
    err.status = 400;
    err.code = def.kind === 'free_spin' ? 'NO_EGG' : 'NO_TOKEN';
    throw err;
  }

  const quantityBefore = have;
  if (!consumeTokenFromUser(user, def)) {
    const err = new Error(`You don't have a ${def.label} to activate.`);
    err.status = 400;
    err.code = def.kind === 'free_spin' ? 'NO_EGG' : 'NO_TOKEN';
    throw err;
  }
  const quantityAfter = tokenCountForUser(user, def);

  if (def.kind === 'boost') {
    const activation = activateTimedBoost(user, def, opts.sourceInventoryItemId || def.itemType);
    return {
      activated: true,
      consumed: true,
      itemType: def.itemType,
      item: {
        key: def.itemKey,
        itemType: def.itemType,
        label: def.label,
        icon: def.icon,
        effect: def.confirmBody,
      },
      activation,
      boost: {
        key: activation.type,
        label: def.activeLabel,
        icon: def.icon,
        expiresAt: activation.expiresAt,
        multiplier: activation.multiplier,
        extended: activation.extended,
      },
      inventoryQuantity: quantityAfter,
      navigationTarget: def.navigationTarget,
      presentation: {
        title: def.presentationTitle,
        subtitle: def.presentationSubtitle,
        activeLabel: def.activeLabel,
        kind: def.itemType,
      },
      transactionAction: activation.extended ? 'boost_extended' : 'boost_activated',
      quantityBefore,
      quantityAfter,
      user,
    };
  }

  if (def.kind === 'free_spin') {
    pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
    user.markModified('perkMachine');
    return {
      activated: true,
      consumed: true,
      itemType: def.itemType,
      item: {
        key: def.itemKey,
        itemType: def.itemType,
        label: def.label,
        icon: def.icon,
        effect: def.confirmBody,
      },
      freeSpins: 1,
      freeSpinsTotal: Number(pm.extraFreeSpins) || 0,
      inventoryQuantity: quantityAfter,
      navigationTarget: def.navigationTarget,
      presentation: {
        title: def.presentationTitle,
        subtitle: def.presentationSubtitle,
        kind: def.itemType,
      },
      transactionAction: 'free_spin_added',
      quantityBefore,
      quantityAfter,
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
  TOKEN_DURATION_MS,
  ACTIVATABLE_ITEMS,
  PERSONAL_EVENTS,
  isBoostActive,
  isPersonalEventActive,
  getSavvyMultiplier,
  getBpXpMultiplier,
  getProfileXpMultiplier,
  serializeActiveBoosts,
  serializeTimedEventTokens,
  serializePersonalEvents,
  activatePerkItem,
  activatePersonalEventToken,
  resolveInventoryToken,
  tokenCountForUser,
};
