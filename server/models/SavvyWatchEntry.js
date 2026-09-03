const mongoose = require('mongoose');

const ENTRY_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'disqualified']);

const savvyWatchEntrySchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    competitionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    displayName: { type: String, required: true },
    vehicleName: { type: String, default: null },
    vehicleMake: { type: String, default: null },
    vehicleModel: { type: String, default: null },
    crewName: { type: String, default: null },
    crewMembers: { type: [String], default: [] },
    shortDescription: { type: String, default: '' },
    caption: { type: String, default: '' },
    entryImage: {
      mimeType: { type: String, default: null },
      size: { type: Number, default: 0 },
      data: { type: Buffer, default: null },
    },
    status: { type: String, enum: ENTRY_STATUSES, default: 'pending', index: true },
    voteCount: { type: Number, default: 0 },
    hostScore: { type: Number, default: null },
    moderationNote: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchEntrySchema.index({ competitionId: 1, userId: 1 });
savvyWatchEntrySchema.index({ competitionId: 1, status: 1, voteCount: -1 });

module.exports = mongoose.model('SavvyWatchEntry', savvyWatchEntrySchema);
module.exports.ENTRY_STATUSES = ENTRY_STATUSES;
