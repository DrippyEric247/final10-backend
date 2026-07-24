import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  readActivationPresentation,
  clearActivationPresentation,
} from '../../lib/inventoryActivationBus';
import TokenActivationPresentation from './TokenActivationPresentation';

/**
 * Global host — shows token activation presentation after navigation.
 */
export default function InventoryActivationHost() {
  const { user } = useAuth() || {};
  const location = useLocation();
  const [payload, setPayload] = useState(null);
  const [progression, setProgression] = useState(null);

  const loadProgression = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/progression/me');
      setProgression(data);
    } catch {
      setProgression(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPayload(null);
      return;
    }
    const pending = readActivationPresentation();
    if (!pending) {
      setPayload(null);
      return;
    }
    const target = String(pending.navigationTarget || '');
    if (target && !location.pathname.startsWith(target.replace(/\/$/, ''))) {
      return;
    }
    setPayload(pending);
    void loadProgression();
  }, [user, location.pathname, loadProgression]);

  if (!payload) return null;

  return (
    <TokenActivationPresentation
      payload={payload}
      progression={progression}
      onDone={() => {
        setPayload(null);
        clearActivationPresentation();
      }}
    />
  );
}
