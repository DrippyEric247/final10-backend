const mongoose = require('mongoose');

const cosmeticInventorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    unlockedItemIds: [{ type: String }],
    /** Client may clear “new” badges — tracked separately from unlocks */
    newItemIds: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CosmeticInventory', cosmeticInventorySchema);
