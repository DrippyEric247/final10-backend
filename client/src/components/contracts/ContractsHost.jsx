import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ContractsHub from './ContractsHub';
import {
  CONTRACTS_CLOSE_EVENT,
  CONTRACTS_OPEN_EVENT,
  DEFAULT_CONTRACTS_APP_ID,
} from '../../lib/contractsBus';

/**
 * Mount once per app. Listens on the universal bus so any surface can open Contracts.
 */
export default function ContractsHost() {
  const [intent, setIntent] = useState(null);

  useEffect(() => {
    const onOpen = (e) => setIntent(e.detail || { ts: Date.now(), appId: DEFAULT_CONTRACTS_APP_ID });
    const onClose = () => setIntent(null);
    window.addEventListener(CONTRACTS_OPEN_EVENT, onOpen);
    window.addEventListener(CONTRACTS_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(CONTRACTS_OPEN_EVENT, onOpen);
      window.removeEventListener(CONTRACTS_CLOSE_EVENT, onClose);
    };
  }, []);

  const close = useCallback(() => setIntent(null), []);

  return (
    <AnimatePresence>
      {intent ? (
        <ContractsHub
          key={intent.ts || 'contracts-hub'}
          open
          onClose={close}
          appId={intent.appId || DEFAULT_CONTRACTS_APP_ID}
          intent={intent}
        />
      ) : null}
    </AnimatePresence>
  );
}
