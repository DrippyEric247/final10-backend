/**
 * Single authoritative Savvy balance reconcile — server database wins.
 */
import { getMyPoints } from './api';
import { applyServerSavvyBalance } from './applyServerSavvyBalance';
import { SAVVY_STORE_UPDATED } from '@savvy/core/events/universeEvents';

const SYNC_EVENT = 'f10:savvy-balance-reconciled';

let inflight = null;

function logSavvyReconcile(detail) {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.log('[SavvyReconcile]', detail);
}

/**
 * Fetch /points/me and patch AuthContext — server database wins.
 * @param {Function} patchUser
 * @param {{ source?: string, currentBalance?: number }} [opts]
 * @returns {Promise<number|null>}
 */
export async function reconcileSavvyBalance(patchUser, opts = {}) {
  if (typeof patchUser !== 'function') return null;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const me = await getMyPoints();
      const serverBalance = Math.max(0, Math.round(Number(me?.pointsBalance ?? me?.savvyPoints) || 0));
      const current = Math.max(0, Math.round(Number(opts.currentBalance) || 0));

      if (current !== serverBalance && current > serverBalance) {
        logSavvyReconcile({
          source: opts.source || 'reconcile',
          warning: 'local_ahead_of_server',
          local: current,
          server: serverBalance,
        });
      }

      applyServerSavvyBalance(patchUser, serverBalance, {
        source: opts.source || 'reconcile',
        oldValue: current,
        finalTotal: serverBalance,
        userId: opts.userId || null,
        lifetimePointsEarned: me?.lifetimePointsEarned,
      });

      try {
        window.dispatchEvent(new CustomEvent(SAVVY_STORE_UPDATED));
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { balance: serverBalance, source: opts.source } }));
      } catch {
        /* ignore */
      }

      return serverBalance;
    } catch (err) {
      logSavvyReconcile({ source: opts.source, error: err?.message || 'failed' });
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export { SYNC_EVENT as SAVVY_BALANCE_RECONCILED_EVENT };
