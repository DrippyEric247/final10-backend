/**
 * Camo Locker progress reporting — the single integration point for wiring real
 * deal activity into camo unlocks.
 *
 * Call this once from wherever a genuine, verified category action happens
 * (e.g. a confirmed deal find in the Retail feed):
 *
 *   import { reportCamoCategoryAction } from '../lib/camoProgress';
 *   await reportCamoCategoryAction('retail');
 *
 * The client only names the category. The server owns the increment size, the
 * daily cap, and whether anything actually unlocks — so this can never be used
 * to grant a reward from the client.
 */

import { recordCamoCategoryProgress } from './api';
import { getCamoItem, CAMOS } from '@savvy/core/config/camoLocker';
import { emitProgressionCelebration } from './progressionCelebrationBus';
import { requestCamoLockerSync } from './camoLockerBus';

const isDev = process.env.NODE_ENV === 'development';

const RARITY_TO_CELEBRATION = {
  common: 'NORMAL',
  uncommon: 'GOOD',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  mythic: 'LEGENDARY',
};

function camoNameFor(itemId) {
  const item = getCamoItem(itemId);
  if (!item) return 'Camo Reward';
  const camo = CAMOS.find((c) => c.id === item.camo);
  return `${camo?.name || item.camo} ${item.rewardType}`;
}

/**
 * Report one qualifying category action.
 * @param {'retail'|'outdoor'|'fitness'|'automotive'|'electronics'} category
 * @param {object} [options]
 * @param {number} [options.increment] hint only — the server clamps it
 * @param {boolean} [options.celebrate] fire unlock celebrations (default true)
 * @returns {Promise<{applied: number, unlocked: string[]}|null>}
 */
export async function reportCamoCategoryAction(category, options = {}) {
  try {
    const result = await recordCamoCategoryProgress(category, options.increment);
    const unlocked = result?.unlocked || [];

    if (isDev) {
      console.info('[CamoLocker] progress reported', {
        category,
        applied: result?.applied || 0,
        cappedForToday: Boolean(result?.cappedForToday),
        unlocked,
      });
    }

    if (unlocked.length) {
      requestCamoLockerSync('camo_unlock');
      if (options.celebrate !== false) {
        for (const itemId of unlocked) {
          const item = getCamoItem(itemId);
          emitProgressionCelebration({
            kind: 'cosmetic',
            label: `${camoNameFor(itemId)} Unlocked`,
            subtitle: item ? `${item.category} collection` : '',
            icon: '🎖️',
            rarity: RARITY_TO_CELEBRATION[item?.rarity] || 'RARE',
            source: 'camo_locker',
            screenShake: true,
            force: true,
          });
        }
      }
    }

    return { applied: result?.applied || 0, unlocked };
  } catch (err) {
    // Progress reporting is best-effort — never block the user's actual action.
    if (isDev) console.info('[CamoLocker] progress report failed', err?.message || err);
    return null;
  }
}
