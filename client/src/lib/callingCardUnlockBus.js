/**
 * Global Calling Card unlock ceremony — COD / battle-pass style reveal.
 *
 *   import { showCallingCardUnlock } from '../lib/callingCardUnlockBus';
 *   showCallingCardUnlock({
 *     cardId: 'first_in_last_out',
 *     unlockReason: 'Earned for joining the Savvy First Responder Program.',
 *     trigger: 'first_responder_program',
 *   });
 */

import { CALLING_CARD_UNLOCK_EVENT } from "@savvy/core/events/universeEvents";

export { CALLING_CARD_UNLOCK_EVENT };

/**
 * @typedef {Object} CallingCardUnlockPayload
 * @property {string} cardId
 * @property {string} [unlockReason] — overrides default copy
 * @property {string} [trigger] — telemetry / source id
 * @property {string} [imageUrl] — optional art URL
 */

/**
 * @param {CallingCardUnlockPayload} payload
 */
export function showCallingCardUnlock(payload) {
  if (typeof window === "undefined") return;
  const cardId = String(payload?.cardId || "").trim();
  if (!cardId) return;
  try {
    window.dispatchEvent(
      new CustomEvent(CALLING_CARD_UNLOCK_EVENT, {
        detail: {
          cardId,
          unlockReason: payload?.unlockReason != null ? String(payload.unlockReason) : "",
          trigger: payload?.trigger != null ? String(payload.trigger) : "",
          imageUrl: payload?.imageUrl != null ? String(payload.imageUrl) : "",
        },
      })
    );
  } catch {
    /* ignore */
  }
}
