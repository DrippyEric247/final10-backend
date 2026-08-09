import React, { useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useContracts from '../../hooks/useContracts';
import { openContractsHub, DEFAULT_CONTRACTS_APP_ID } from '../../lib/contractsBus';
import '../../styles/ContractsHub.css';

/**
 * Compact universal Contracts entry — mirrors Savvy Wallet dock accessibility.
 * @param {{ appId?: string, className?: string }} props
 */
export default function ContractsBubble({ appId = DEFAULT_CONTRACTS_APP_ID, className = '' }) {
  const { user } = useAuth();
  const { claimableCount } = useContracts({ appId, enabled: Boolean(user) });

  useEffect(() => {
    if (!user) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        openContractsHub({ appId, source: 'keyboard_shortcut' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, appId]);

  if (!user) return null;

  const badge = claimableCount > 0 ? (claimableCount > 9 ? '9+' : String(claimableCount)) : null;

  return (
    <button
      type="button"
      className={`f10-contracts-bubble ${className}`.trim()}
      onClick={() => openContractsHub({ appId, source: 'contracts_bubble' })}
      aria-label={badge ? `Contracts, ${claimableCount} rewards ready` : 'Open Contracts'}
      title="Contracts"
    >
      <ClipboardList size={16} strokeWidth={2.4} aria-hidden />
      <span className="f10-contracts-bubble__label">Contracts</span>
      {badge ? <span className="f10-contracts-bubble__badge">{badge}</span> : null}
    </button>
  );
}
