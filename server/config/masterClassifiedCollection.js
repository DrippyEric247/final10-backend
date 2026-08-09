/**
 * Classified / Master Collection — server mirror of savvy-core config.
 * SOURCE OF TRUTH: packages/savvy-core/src/config/masterClassifiedCollection.js
 */

const {
  CAMOS,
  CAMO_ITEMS,
  toPercent,
} = require('./camoLocker');

const CAMO_VISIBILITY = Object.freeze({ public: 'public', adminOwner: 'admin_owner' });

const MASTER_CLASSIFIED_VERSION = 1;
const MASTER_CLASSIFIED_FAMILY = 'master_classified';
const MASTER_CLASSIFIED_TIER = 'MASTER';
const MASTER_CLASSIFIED_DISPLAY_NAME = 'CLASSIFIED COLLECTION';

const MASTER_REQUIRED_CAMO_IDS = Object.freeze([
  'woodland',
  'tiger',
  'arctic',
  'gold',
  'diamond',
  'darkNebula',
]);

const MASTER_SHOE_TICKET_STATES = Object.freeze([
  'LOCKED',
  'EARNED',
  'REDEEMABLE',
  'SUBMITTED',
  'APPROVED',
  'IN_CUSTOMIZATION',
  'SHIPPED_BACK',
  'COMPLETED',
]);

const MASTER_SAVVY_BONUS_FRACTION = 0.25;
const MASTER_BONUS_EMBLEM_ID = 'sigil_master_classified';
const MASTER_BONUS_CALLING_CARD_ID = 'card_master_classified';
const MASTER_BONUS_LOBBY_ANIM_ID = 'lobby_anim_master_classified';

const MASTER_CLASSIFIED_COLLECTION = Object.freeze({
  id: MASTER_CLASSIFIED_FAMILY,
  name: MASTER_CLASSIFIED_DISPLAY_NAME,
  tier: MASTER_CLASSIFIED_TIER,
  icon: '👑',
  accentColor: '#a855f7',
  accentColorAlt: '#fbbf24',
  theme: 'Gold + Diamond + Dark Nebula Fusion Weave',
  blurb:
    'The fusion of Gold, Diamond, and Dark Nebula. Only elite Savvy Hunters unlock the full Master Set.',
  shoeTicketCopy: 'Choose your pair. Ship it in. We make it Savvy.',
  shoeTicketDisclaimer:
    'Example visualization only — your ticket covers professional customization of an approved compatible pair you provide.',
  bonuses: Object.freeze([
    Object.freeze({ id: 'savvy_bonus', label: '+25% Savvy Point Bonus', kind: 'multiplier' }),
    Object.freeze({ id: 'master_outfit', label: 'Exclusive Master Outfit', kind: 'outfit' }),
    Object.freeze({ id: 'master_badge', label: 'Master Badge', kind: 'emblem', cosmeticId: MASTER_BONUS_EMBLEM_ID }),
    Object.freeze({
      id: 'master_calling_card',
      label: 'Master Calling Card',
      kind: 'calling_card',
      cosmeticId: MASTER_BONUS_CALLING_CARD_ID,
    }),
    Object.freeze({
      id: 'master_lobby_anim',
      label: 'Unique Lobby Animation',
      kind: 'lobby_animation',
      cosmeticId: MASTER_BONUS_LOBBY_ANIM_ID,
    }),
  ]),
});

const MASTER_CLASSIFIED_ITEMS = Object.freeze([
  Object.freeze({
    id: 'master_classified_hat',
    slug: 'master-hat',
    name: 'MASTER HAT',
    shortName: 'HAT',
    assetPath: '/assets/classified/master-hat.png',
  }),
  Object.freeze({
    id: 'master_classified_mask',
    slug: 'master-mask',
    name: 'MASTER MASK',
    shortName: 'MASK',
    assetPath: '/assets/classified/master-mask.png',
  }),
  Object.freeze({
    id: 'master_classified_tshirt',
    slug: 'master-tshirt',
    name: 'MASTER T-SHIRT',
    shortName: 'T-SHIRT',
    assetPath: '/assets/classified/master-tshirt.png',
  }),
  Object.freeze({
    id: 'master_classified_arm_sleeve',
    slug: 'master-arm-sleeve',
    name: 'ONE OF ONE ARM SLEEVE',
    shortName: 'ARM SLEEVE',
    assetPath: '/assets/classified/master-arm-sleeve.png',
  }),
  Object.freeze({
    id: 'master_classified_gloves',
    slug: 'master-gloves',
    name: 'MASTER GLOVES',
    shortName: 'GLOVES',
    assetPath: '/assets/classified/master-gloves.jpeg',
  }),
  Object.freeze({
    id: 'master_classified_shorts',
    slug: 'master-shorts',
    name: 'MASTER SHORTS',
    shortName: 'SHORTS',
    assetPath: '/assets/classified/master-shorts.png',
  }),
  Object.freeze({
    id: 'master_classified_leg_sleeve',
    slug: 'master-leg-sleeve',
    name: 'ONE OF ONE LEG SLEEVE',
    shortName: 'LEG SLEEVE',
    assetPath: '/assets/classified/master-leg-sleeve.png',
  }),
  Object.freeze({
    id: 'master_classified_socks',
    slug: 'master-socks',
    name: 'MASTER SOCKS',
    shortName: 'SOCKS',
    assetPath: '/assets/classified/master-socks.png',
  }),
  Object.freeze({
    id: 'master_classified_glasses',
    slug: 'master-glasses',
    name: 'MASTER GLASSES',
    shortName: 'GLASSES',
    assetPath: '/assets/classified/master-glasses.png',
  }),
  Object.freeze({
    id: 'master_classified_custom_shoe_ticket',
    slug: 'master-custom-shoe-ticket',
    name: 'MASTER CUSTOM SHOE TICKET',
    shortName: 'CUSTOM SHOE TICKET',
    kind: 'shoe_ticket',
    assetPath: '/assets/classified/master-custom-shoe-ticket.png',
  }),
]);

const MASTER_CLASSIFIED_HERO_ASSET = '/assets/classified/classified-hero-outfit.png';

const ITEMS_BY_ID = Object.freeze(
  MASTER_CLASSIFIED_ITEMS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {})
);

const MASTER_CLASSIFIED_ITEM_IDS = Object.freeze(MASTER_CLASSIFIED_ITEMS.map((i) => i.id));

function getCamo(camoId) {
  return CAMOS.find((c) => c.id === camoId) || null;
}

function listCamoItemsByCamo(camoId) {
  return CAMO_ITEMS.filter((i) => i.camo === camoId);
}

function getMasterClassifiedItem(itemId) {
  return ITEMS_BY_ID[itemId] || null;
}

function isMasterClassifiedItemId(itemId) {
  return typeof itemId === 'string' && Boolean(ITEMS_BY_ID[itemId]);
}

function listMasterRequiredItemsForCamo(camoId) {
  return listCamoItemsByCamo(camoId).filter(
    (item) => item.visibility === CAMO_VISIBILITY.public && !item.grantOnly
  );
}

function evaluateMasterCamoProgress(unlockedIds) {
  const set = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds || []);
  return MASTER_REQUIRED_CAMO_IDS.map((camoId) => {
    const camo = getCamo(camoId);
    const items = listMasterRequiredItemsForCamo(camoId);
    const unlocked = items.filter((i) => set.has(i.id));
    return {
      camoId,
      camoName: camo?.name || camoId,
      collectionName: camo?.collectionName || `${camoId} Collection`,
      accentColor: camo?.accentColor || '#a855f7',
      accentColorAlt: camo?.accentColorAlt || '#fbbf24',
      total: items.length,
      unlocked: unlocked.length,
      percent: toPercent(unlocked.length, items.length),
      complete: items.length > 0 && unlocked.length === items.length,
    };
  });
}

function isMasterClassifiedEligible(unlockedIds) {
  const rows = evaluateMasterCamoProgress(unlockedIds);
  return rows.length > 0 && rows.every((row) => row.complete);
}

function summarizeMasterClassifiedCollection(ctx = {}) {
  const camoRows = evaluateMasterCamoProgress(ctx.camoUnlockedIds);
  const camoComplete = camoRows.filter((r) => r.complete).length;
  const camoTotal = camoRows.length;

  const masterSet =
    ctx.masterUnlockedIds instanceof Set
      ? ctx.masterUnlockedIds
      : new Set(ctx.masterUnlockedIds || []);
  const masterUnlocked = MASTER_CLASSIFIED_ITEMS.filter((i) => masterSet.has(i.id)).length;
  const masterTotal = MASTER_CLASSIFIED_ITEMS.length;

  const camoEligible = isMasterClassifiedEligible(ctx.camoUnlockedIds);
  const mastered = camoEligible && masterUnlocked >= masterTotal;

  let status = 'CLASSIFIED';
  if (mastered) status = 'MASTERED';
  else if (camoComplete > 0 || masterUnlocked > 0) status = 'IN_PROGRESS';

  return {
    version: MASTER_CLASSIFIED_VERSION,
    status,
    camoRows,
    camoComplete,
    camoTotal,
    camoPercent: toPercent(camoComplete, camoTotal),
    masterUnlocked,
    masterTotal,
    masterPercent: toPercent(masterUnlocked, masterTotal),
    eligible: camoEligible,
    mastered,
    collectionComplete: mastered,
  };
}

function listMasterProgressCamos() {
  return CAMOS.filter((c) => MASTER_REQUIRED_CAMO_IDS.includes(c.id));
}

module.exports = {
  MASTER_CLASSIFIED_VERSION,
  MASTER_CLASSIFIED_FAMILY,
  MASTER_CLASSIFIED_TIER,
  MASTER_CLASSIFIED_DISPLAY_NAME,
  MASTER_REQUIRED_CAMO_IDS,
  MASTER_SHOE_TICKET_STATES,
  MASTER_SAVVY_BONUS_FRACTION,
  MASTER_BONUS_EMBLEM_ID,
  MASTER_BONUS_CALLING_CARD_ID,
  MASTER_BONUS_LOBBY_ANIM_ID,
  MASTER_CLASSIFIED_COLLECTION,
  MASTER_CLASSIFIED_ITEMS,
  MASTER_CLASSIFIED_HERO_ASSET,
  MASTER_CLASSIFIED_ITEM_IDS,
  getMasterClassifiedItem,
  isMasterClassifiedItemId,
  listMasterRequiredItemsForCamo,
  evaluateMasterCamoProgress,
  isMasterClassifiedEligible,
  summarizeMasterClassifiedCollection,
  listMasterProgressCamos,
};
