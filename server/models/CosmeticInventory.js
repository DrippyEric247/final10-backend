const mongoose = require('mongoose');

/**
 * Camo Locker unlock metadata. The camo item ID also lives in
 * `unlockedItemIds` so every existing cosmetic path (grants, admin revoke,
 * `GET /cosmetics/me`) keeps working unchanged — this sub-document only adds
 * the extra facts a camo needs (when it was earned, its serial).
 */
const camoUnlockSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    /** Sequential mint number within the item, e.g. 127 -> "#000127" */
    serialNumber: { type: Number, default: null },
    source: { type: String, default: 'system' },
    /** Set once the user claims a physical/redeemable version of the reward. */
    claimedAt: { type: Date, default: null },
  },
  { _id: false }
);

const cosmeticInventorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    unlockedItemIds: [{ type: String }],
    /** Client may clear “new” badges — tracked separately from unlocks */
    newItemIds: [{ type: String }],

    /** Camo Locker: per-item unlock metadata (dates, serials, claims). */
    camoUnlocks: { type: [camoUnlockSchema], default: [] },
    /**
     * Camo Locker: authoritative per-category activity counters that drive
     * unlock progress. Keys are camo category IDs (retail, outdoor, …).
     */
    camoCategoryProgress: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    /** Per-category daily increment guard: category -> YYYY-MM-DD -> count */
    camoDailyCounters: {
      type: Map,
      of: new mongoose.Schema(
        { day: { type: String, default: '' }, count: { type: Number, default: 0 } },
        { _id: false }
      ),
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CosmeticInventory', cosmeticInventorySchema);
