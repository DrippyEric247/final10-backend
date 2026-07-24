import { useEffect, useState } from 'react';
import { getInventoryStatus } from '../lib/api';

const INVENTORY_UPDATED = 'f10:inventory-updated';

export function notifyInventoryUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED));
}

/**
 * Server-authoritative active boosts with live countdown refresh.
 */
export function useActiveBoosts(enabled = true) {
  const [boosts, setBoosts] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setBoosts([]);
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getInventoryStatus();
        if (!cancelled) setBoosts(data?.activeBoosts || []);
      } catch {
        if (!cancelled) setBoosts([]);
      }
    };

    void load();
    const onUpdate = () => void load();
    window.addEventListener(INVENTORY_UPDATED, onUpdate);
    const id = window.setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(INVENTORY_UPDATED, onUpdate);
    };
  }, [enabled]);

  return boosts;
}
