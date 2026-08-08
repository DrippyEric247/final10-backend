import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import SavvyCamoLocker from './SavvyCamoLocker';
import { CAMO_LOCKER_OPEN_EVENT, CAMO_LOCKER_CLOSE_EVENT } from '../../lib/camoLockerBus';

/**
 * Mount once per app. Listens on the universal bus so any surface — nav, wallet,
 * profile, Savvy Scout, a game HUD — can open the locker with
 * `openCamoLocker()` without importing the modal.
 */
export default function CamoLockerHost() {
  const [intent, setIntent] = useState(null);

  useEffect(() => {
    const onOpen = (e) => setIntent(e.detail || { ts: Date.now() });
    const onClose = () => setIntent(null);
    window.addEventListener(CAMO_LOCKER_OPEN_EVENT, onOpen);
    window.addEventListener(CAMO_LOCKER_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(CAMO_LOCKER_OPEN_EVENT, onOpen);
      window.removeEventListener(CAMO_LOCKER_CLOSE_EVENT, onClose);
    };
  }, []);

  const close = useCallback(() => setIntent(null), []);

  return (
    <AnimatePresence>
      {intent ? (
        <SavvyCamoLocker key={intent.ts || 'camo-locker'} open onClose={close} intent={intent} />
      ) : null}
    </AnimatePresence>
  );
}
