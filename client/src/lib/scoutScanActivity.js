/**
 * Global registry for active search / AI scan operations.
 * Drives the temporary Savvy Scout scanning overlay (not rate-limit cooling).
 */

let activeCount = 0;
const sources = new Map();
const listeners = new Set();

function notify() {
  const snapshot = getScoutScanActivity();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  });
}

export function getScoutScanActivity() {
  return { isScanning: activeCount > 0, activeCount };
}

export function subscribeScoutScanActivity(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginScoutScan(sourceId) {
  const id = String(sourceId || '').trim();
  if (!id || sources.has(id)) return;
  sources.set(id, true);
  activeCount = sources.size;
  notify();
}

export function endScoutScan(sourceId) {
  const id = String(sourceId || '').trim();
  if (!id || !sources.has(id)) return;
  sources.delete(id);
  activeCount = sources.size;
  notify();
}
