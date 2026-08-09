import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ClipboardList, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useContracts from '../../hooks/useContracts';
import { DEFAULT_CONTRACTS_APP_ID } from '../../lib/contractsBus';
import ContractCard from './ContractCard';
import '../../styles/ContractsHub.css';

/**
 * Universal Savvy Contracts dashboard — app-scoped missions + universe cross-app objectives.
 * @param {{ open: boolean, onClose: () => void, appId?: string, intent?: object|null }} props
 */
export default function ContractsHub({
  open,
  onClose,
  appId = DEFAULT_CONTRACTS_APP_ID,
  intent = null,
}) {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [tab, setTab] = useState(intent?.tab === 'completed' ? 'completed' : 'active');

  const {
    loading,
    summary,
    appContracts,
    universeContracts,
    completedRecent,
    claimableCount,
    claimingId,
    claim,
    reload,
  } = useContracts({ appId, enabled: open && Boolean(user) });

  const appLabel = useMemo(() => {
    if (appId === 'final10') return 'FINAL10';
    return String(appId || 'APP').toUpperCase();
  }, [appId]);

  const activeAppContracts = useMemo(
    () => appContracts.filter((c) => !c.isClaimed),
    [appContracts]
  );
  const activeUniverse = useMemo(
    () => universeContracts.filter((c) => !c.isClaimed),
    [universeContracts]
  );

  if (!open) return null;

  return createPortal(
    <motion.div
      className="f10-contracts-hub"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Contracts"
    >
      <button type="button" className="f10-contracts-hub__backdrop" aria-label="Close" onClick={onClose} />
      <motion.div
        className="f10-contracts-hub__panel"
        initial={reduceMotion ? false : { y: '6%', opacity: 0.96 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduceMotion ? undefined : { y: '8%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
      >
        <header className="f10-contracts-hub__header">
          <div className="f10-contracts-hub__title-row">
            <div>
              <div className="f10-contracts-hub__kicker">
                <ClipboardList size={16} strokeWidth={2.3} aria-hidden /> CONTRACTS
              </div>
              <p className="f10-contracts-hub__sub">
                Complete objectives. Earn rewards. Keep progressing through the Savvy Universe.
              </p>
            </div>
            <button type="button" className="f10-contracts-hub__close" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          <div className="f10-contracts-hub__stats">
            <div className="f10-contracts-hub__stat">
              <span>Active</span>
              <strong>{summary?.activeCount ?? '—'}</strong>
            </div>
            <div className="f10-contracts-hub__stat">
              <span>Completed Today</span>
              <strong>{summary?.completedToday ?? 0}</strong>
            </div>
            <div className="f10-contracts-hub__stat">
              <span>Savvy Earned</span>
              <strong>{summary?.savvyEarnedToday?.toLocaleString?.() ?? 0}</strong>
            </div>
            <div className="f10-contracts-hub__stat">
              <span>Streak</span>
              <strong>{summary?.contractStreak ?? '—'}</strong>
            </div>
          </div>

          <div className="f10-contracts-hub__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'active'}
              className={tab === 'active' ? 'is-active' : ''}
              onClick={() => setTab('active')}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'completed'}
              className={tab === 'completed' ? 'is-active' : ''}
              onClick={() => setTab('completed')}
            >
              Completed
            </button>
          </div>
        </header>

        <div className="f10-contracts-hub__body">
          {loading && !summary ? (
            <div className="f10-contracts-hub__loading">Loading contracts…</div>
          ) : tab === 'completed' ? (
            <section className="f10-contracts-hub__section">
              <h2>RECENTLY COMPLETED</h2>
              {completedRecent.length ? (
                <div className="f10-contracts-hub__grid">
                  {completedRecent.map((c) => (
                    <ContractCard key={`${c.id}-${c.periodKey}`} contract={c} />
                  ))}
                </div>
              ) : (
                <div className="f10-contracts-hub__empty">
                  <CheckCircle2 size={18} aria-hidden />
                  <p>No completed contracts yet. Finish an objective to see it here.</p>
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="f10-contracts-hub__section">
                <h2>{appLabel} CONTRACTS</h2>
                {activeAppContracts.length ? (
                  <div className="f10-contracts-hub__grid">
                    {activeAppContracts.map((c) => (
                      <ContractCard
                        key={c.id}
                        contract={c}
                        onClaim={claim}
                        claiming={claimingId === c.id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="f10-contracts-hub__empty">
                    <p>
                      <strong>No active contracts right now.</strong>
                    </p>
                    <p>Savvy Scout will notify you when new objectives become available.</p>
                  </div>
                )}
              </section>

              {activeUniverse.length ? (
                <section className="f10-contracts-hub__section f10-contracts-hub__section--universe">
                  <h2>SAVVY UNIVERSE CONTRACTS</h2>
                  <p className="f10-contracts-hub__section-note">Cross-app objectives — occasional universe-wide missions.</p>
                  <div className="f10-contracts-hub__grid">
                    {activeUniverse.map((c) => (
                      <ContractCard
                        key={c.id}
                        contract={c}
                        onClaim={claim}
                        claiming={claimingId === c.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        {claimableCount > 0 ? (
          <div className="f10-contracts-hub__claim-banner" role="status">
            {claimableCount} reward{claimableCount === 1 ? '' : 's'} ready to claim
          </div>
        ) : null}

        <button type="button" className="f10-contracts-hub__refresh" onClick={() => reload()}>
          Refresh
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}
