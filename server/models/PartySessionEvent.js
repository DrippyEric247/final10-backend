const mongoose = require('mongoose');

/**
 * PartySessionEvent — per-action log during a Squad Sync session.
 *
 * Used to:
 *   • determine which members are "active" (recent valid action)
 *   • accumulate Sync Energy
 *   • rank the top contributor for the session summary
 *   • detect suspicious bursts (anti-abuse)
 *
 * Only these eventTypes grant energy / count toward active status:
 *   save_deal, share_deal, purchase_clickout, verified_reward
 */
const VALID_EVENT_TYPES = [
  'save_deal',
  'share_deal',
  'purchase_clickout',
  'verified_reward',
];

const partySessionEventSchema = new mongoose.Schema(
  {
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Scopes events to a specific active session (sessionStartedAt timestamp). */
    sessionStartedAt: { type: Date, required: true, index: true },

    eventType: {
      type: String,
      enum: VALID_EVENT_TYPES,
      required: true,
    },

    /** Energy this event granted to the party (post anti-abuse clamp). */
    energyGranted: { type: Number, default: 0 },

    /** Savvy (points) earned by the user for this action (with boost applied). */
    savvyEarned: { type: Number, default: 0 },

    /**
     * Personal multiplier at the time of the event (snapshot, for analytics).
     * Optional; if the client doesn't supply one we default to 1.
     */
    personalMultiplierAtEvent: { type: Number, default: 1 },

    /** Optional deal/offer/auction id the event refers to, for attribution. */
    refId: { type: String, default: null },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

partySessionEventSchema.index({ partyId: 1, sessionStartedAt: 1, createdAt: -1 });
partySessionEventSchema.index({ partyId: 1, userId: 1, createdAt: -1 });

partySessionEventSchema.statics.VALID_EVENT_TYPES = VALID_EVENT_TYPES;

module.exports = mongoose.model('PartySessionEvent', partySessionEventSchema);
module.exports.VALID_EVENT_TYPES = VALID_EVENT_TYPES;
