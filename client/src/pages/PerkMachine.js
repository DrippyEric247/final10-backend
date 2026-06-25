import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getPerkMachineStatus,
  spinPerkMachine,
  hatchPerkEgg,
  checkPerkMachineAdminAccess,
} from '../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST, useSavvyPoints } from '../store/savvyStore';
import { shouldShowAdminNav } from '../lib/adminAccess';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import PerkMachineAdminPanel from '../components/perk/PerkMachineAdminPanel';
import PerkMachineScoutFloater from '../components/perk/PerkMachineScoutFloater';
import PerkMachineEnvironment from '../components/perk/PerkMachineEnvironment';
import EggHatchery from '../components/perk/EggHatchery';
import '../styles/PerkMachine.css';
import '../styles/EggHatchery.css';

const REEL_SYMBOLS = ['🪙', '💰', '🥚', '⚡', '✨', '🛡️', '🎖️', '🎰', '💎', '🔥'];

function formatCountdown(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Ready soon';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function rarityClass(rarity) {
  if (rarity === 'legendary') return 'perk-reward--legendary';
  if (rarity === 'rare') return 'perk-reward--rare';
  if (rarity === 'uncommon') return 'perk-reward--uncommon';
  return 'perk-reward--common';
}

function ReelColumn({ spinning, symbol, revealed, highlight }) {
  return (
    <div
      className={`perk-reel ${spinning ? 'perk-reel--spinning' : ''} ${revealed ? 'perk-reel--revealed' : ''} ${
        highlight ? 'perk-reel--win' : ''
      }`}
    >
      <div className="perk-reel__window">
        <div className={`perk-reel__strip ${spinning ? 'perk-reel__strip--animate' : ''}`}>
          {spinning
            ? REEL_SYMBOLS.concat(REEL_SYMBOLS).map((s, i) => (
                <span key={`${s}-${i}`} className="perk-reel__symbol">
                  {s}
                </span>
              ))
            : (
              <span className="perk-reel__symbol perk-reel__symbol--final">{symbol || '❓'}</span>
            )}
        </div>
      </div>
    </div>
  );
}

function EggInventoryPanel({ inventory, pulseTier }) {
  const rows = [
    { key: 'common', label: 'Common', className: 'egg-common' },
    { key: 'rare', label: 'Rare', className: 'egg-rare' },
    { key: 'epic', label: 'Epic', className: 'egg-epic' },
    { key: 'legendary', label: 'Legendary', className: 'egg-legendary' },
    { key: 'extraFreeSpin', label: 'Extra Free Spin', className: 'egg-extra' },
  ];
  return (
    <div className="perk-eggs-panel" id="perk-egg-inventory">
      <div className="perk-eggs-panel__title">🥚 Eggs Owned</div>
      <div className="perk-eggs-panel__grid">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`perk-egg-row ${row.className} ${pulseTier === row.key ? 'perk-egg-row--pulse' : ''}`}
          >
            <span className="perk-egg-row__label">{row.label}</span>
            <span className="perk-egg-row__count">×{Number(inventory?.[row.key]) || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerkMachine() {
  const { user, refreshProfile, patchUser } = useAuth();
  const savvy = useSavvyPoints();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [reelPhase, setReelPhase] = useState('idle');
  const [displayRewards, setDisplayRewards] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [resultMessage, setResultMessage] = useState('');
  const [balanceBump, setBalanceBump] = useState(false);
  const [eggPulseTier, setEggPulseTier] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [machineHover, setMachineHover] = useState(false);
  const spinLock = useRef(false);
  const machinePanelRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await getPerkMachineStatus();
      setStatus(data);
      setError('');
      return data;
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load Perk Machine.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.nextFreeSpinAt) {
      setCountdown('');
      return undefined;
    }
    const tick = () => setCountdown(formatCountdown(status.nextFreeSpinAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status?.nextFreeSpinAt]);

  useEffect(() => {
    if (!shouldShowAdminNav(user)) return;
    checkPerkMachineAdminAccess()
      .then(() => setShowAdmin(true))
      .catch(() => setShowAdmin(false));
  }, [user]);

  /**
   * Single source of truth for the displayed balance: the Savvy store (same as
   * the floating HUD), falling back to the latest server status / auth user.
   * Always rounded so the pill and the HUD can never disagree (e.g. 7895.5 vs 7896).
   */
  const savvyBalance = Math.round(
    Number(
      (savvy && Number.isFinite(savvy.savvyPoints) ? savvy.savvyPoints : null) ??
        status?.savvyBalance ??
        user?.savvyPoints ??
        0
    )
  );
  const slotCount = displayRewards.length || 1;

  const reelSymbols = useMemo(() => {
    if (!displayRewards.length) return ['🎰', '🎰', '🎰'];
    const out = [...displayRewards.map((r) => r.icon || '🎁')];
    while (out.length < 3) out.push('✨');
    return out.slice(0, 3);
  }, [displayRewards]);

  const eggsWaiting = useMemo(() => {
    const inv = status?.eggInventory || {};
    return ['common', 'rare', 'epic', 'legendary'].reduce(
      (sum, key) => sum + (Number(inv[key]) || 0),
      0
    );
  }, [status?.eggInventory]);

  const runRevealSequence = useCallback((rewards, message) => {
    setDisplayRewards(rewards);
    setRevealedCount(0);
    setReelPhase('spinning');
    setResultMessage('');

    window.setTimeout(() => {
      setReelPhase('revealing');
      let i = 0;
      const step = () => {
        i += 1;
        setRevealedCount(i);
        if (i < rewards.length) {
          window.setTimeout(step, 900);
        } else {
          window.setTimeout(() => {
            setReelPhase('complete');
            setResultMessage(message);
            setSpinning(false);
            spinLock.current = false;
          }, 600);
        }
      };
      window.setTimeout(step, 1200);
    }, 1400);
  }, []);

  const handleSpin = useCallback(
    async (mode) => {
      if (spinLock.current || spinning) return;
      spinLock.current = true;
      setSpinning(true);
      setError('');
      setResultMessage('');
      setReelPhase('spinning');
      setDisplayRewards([]);
      setRevealedCount(0);

      const balanceBefore = savvyBalance;
      try {
        const result = await spinPerkMachine(mode);
        const rewards = Array.isArray(result.rewards) ? result.rewards : [];
        setStatus(result.status || status);

        const eggWin = rewards.find((r) => r.type === 'egg');
        if (eggWin?.eggTier) {
          setEggPulseTier(eggWin.eggTier);
          window.setTimeout(() => setEggPulseTier(null), 2400);
        }

        const savvyWin = rewards.reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
        if (savvyWin > 0) {
          setBalanceBump(true);
          window.setTimeout(() => setBalanceBump(false), 1800);
        }

        // Backend is the single source of truth. Patch the canonical balance
        // base immediately (withLoadout derives savvyPoints from this field) so
        // the HUD + balance pill update together, then reconcile via refresh.
        const nextBalance = Math.round(
          Number(result?.savvyBalance ?? result?.status?.savvyBalance ?? user?.savvyPoints ?? 0)
        );
        if (typeof patchUser === 'function') {
          patchUser({ savvyPointsServerBase: nextBalance, savvyPoints: nextBalance });
        }
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();

        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[perk-machine/spin]', {
            mode,
            balanceBefore,
            savvyWin,
            savvyCost: result?.savvyCost ?? null,
            balanceAfter: nextBalance,
            dbUpdate: 'success',
            uiRefresh: 'complete',
          });
        }

        runRevealSequence(rewards, result.message || result.resultMessage || 'Nice pull, Operator.');
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Spin failed.';
        setError(msg);
        setSpinning(false);
        setReelPhase('idle');
        spinLock.current = false;
      }
    },
    [refreshProfile, runRevealSequence, spinning, status, patchUser, user, savvyBalance]
  );

  const handleHatch = useCallback(
    async (eggTier) => {
      const balanceBefore = savvyBalance;
      const result = await hatchPerkEgg(eggTier);
      if (result?.status) setStatus(result.status);
      const savvyGranted = Number(result?.reward?.savvyGranted) || 0;
      if (savvyGranted > 0) {
        setBalanceBump(true);
        window.setTimeout(() => setBalanceBump(false), 1800);
      }

      const nextBalance = Math.round(
        Number(result?.savvyBalance ?? result?.status?.savvyBalance ?? user?.savvyPoints ?? 0)
      );
      if (typeof patchUser === 'function') {
        patchUser({ savvyPointsServerBase: nextBalance, savvyPoints: nextBalance });
      }
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      if (typeof refreshProfile === 'function') await refreshProfile();

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[perk-machine/hatch]', {
          eggTier,
          balanceBefore,
          savvyWin: savvyGranted,
          balanceAfter: nextBalance,
          dbUpdate: 'success',
          uiRefresh: 'complete',
        });
      }
      return result;
    },
    [refreshProfile, patchUser, user, savvyBalance]
  );

  const handleHatchStatusUpdate = useCallback((nextStatus) => {
    if (nextStatus) setStatus(nextStatus);
  }, []);

  const scrollToMachine = useCallback(() => {
    machinePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (loading) {
    return (
      <div className="perk-page">
        <LoadingState message="Powering up Savvy Perk Machine…" />
      </div>
    );
  }

  const freeReady = Boolean(status?.freeSpinAvailable);
  const tierLabel = status?.subscriptionLabel || 'Free';
  const operatorLevel = tierLabel === 'Free' ? 'Founding Tester' : `${tierLabel} Operator`;
  const multiplier = tierLabel === 'Pro' || tierLabel === 'Premium' ? '1.50x' : '1.00x';

  return (
    <div className="perk-page">
      <div className="perk-page__glow" aria-hidden />
      <PerkMachineEnvironment
        phase={reelPhase}
        hovering={machineHover}
        eggsWaiting={eggsWaiting}
        operatorLevel={operatorLevel}
        multiplier={multiplier}
      />

      <header className="perk-header">
        <div>
          <p className="perk-kicker">Final10 × Savvy Universe</p>
          <h1 className="perk-title">🎰 Savvy Perk Machine</h1>
          <p className="perk-subtitle">Spin for boosts, eggs, Savvy, and exclusive rewards.</p>
        </div>
        <div className="perk-header__actions">
          <Link to="/profile#savvy-balance" className="perk-balance-pill">
            <span className="perk-balance-pill__label">Savvy Balance</span>
            <span className={`perk-balance-pill__value ${balanceBump ? 'perk-balance-pill__value--bump' : ''}`}>
              {savvyBalance.toLocaleString()}
            </span>
          </Link>
          <span className="perk-tier-pill">{tierLabel} odds</span>
        </div>
      </header>

      <div className="perk-layout">
        <section className="perk-machine-stage">
          <div
            ref={machinePanelRef}
            className={`perk-machine ${reelPhase === 'spinning' ? 'perk-machine--active' : ''} ${
              machineHover ? 'perk-machine--hover' : ''
            }`}
            onMouseEnter={() => setMachineHover(true)}
            onMouseLeave={() => setMachineHover(false)}
          >
            <img
              src={
                reelPhase === 'spinning'
                  ? '/assets/perk-machine/perk-machine-spin.png'
                  : '/assets/perk-machine/perk-machine-idle.png'
              }
              alt=""
              className="perk-machine__art"
              aria-hidden
            />
            <div className="perk-machine__overlay">
              <div className="perk-machine__sign">
                <span className="perk-machine__sign-savvy">SAVVY</span>
                <span className="perk-machine__sign-sub">PERK MACHINE</span>
              </div>

              <div className={`perk-reels perk-reels--slots-${Math.min(slotCount, 3)}`}>
                {[0, 1, 2].slice(0, Math.max(slotCount, 3)).map((idx) => (
                  <ReelColumn
                    key={idx}
                    spinning={reelPhase === 'spinning' || (reelPhase === 'revealing' && idx >= revealedCount)}
                    symbol={reelSymbols[idx]}
                    revealed={reelPhase === 'revealing' ? idx < revealedCount : reelPhase === 'complete'}
                    highlight={reelPhase === 'complete' && Boolean(displayRewards[idx])}
                  />
                ))}
              </div>
            </div>

            <PerkMachineScoutFloater
              panelRef={machinePanelRef}
              reelPhase={reelPhase}
              displayRewards={displayRewards}
              subscriptionLabel={tierLabel}
              error={error}
              eggPulseTier={eggPulseTier}
              hovering={machineHover}
            />
          </div>

          <div className="perk-free-timer">
            {freeReady ? (
              <span className="perk-free-timer__ready">✅ Free Daily Spin ready</span>
            ) : (
              <span className="perk-free-timer__wait">
                ⏳ Next free spin in <strong>{countdown || '…'}</strong>
              </span>
            )}
          </div>

          {error ? (
            <div className="perk-error" role="alert">
              {error}
              {error.toLowerCase().includes('not enough savvy') ? (
                <div className="perk-error__cta">
                  <Link to="/profile#savvy-balance">Earn more Savvy</Link>
                  <span> · </span>
                  <Link to="/premium">Upgrade tier</Link>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="perk-spin-actions" data-perk-protected="spin-buttons">
            <button
              type="button"
              className="perk-btn perk-btn--free"
              disabled={spinning || !freeReady}
              onClick={() => void handleSpin('free')}
            >
              Free Daily Spin
            </button>
            <button
              type="button"
              className="perk-btn perk-btn--slot1"
              disabled={spinning || savvyBalance < 20}
              onClick={() => void handleSpin('paid_1')}
            >
              20 Savvy · 1 Slot
            </button>
            <button
              type="button"
              className="perk-btn perk-btn--slot2"
              disabled={spinning || savvyBalance < 40}
              onClick={() => void handleSpin('paid_2')}
            >
              40 Savvy · 2 Slots
            </button>
            <button
              type="button"
              className="perk-btn perk-btn--slot3"
              disabled={spinning || savvyBalance < 60}
              onClick={() => void handleSpin('paid_3')}
            >
              60 Savvy · 3 Slots
            </button>
          </div>

          {reelPhase === 'complete' && displayRewards.length > 0 ? (
            <div className="perk-result-summary">
              <div className="perk-result-summary__title">{resultMessage}</div>
              <div className="perk-result-summary__grid">
                {displayRewards.map((reward) => (
                  <div key={`${reward.id}-${reward.label}`} className={`perk-reward-card ${rarityClass(reward.rarity)}`}>
                    <span className="perk-reward-card__icon">{reward.icon}</span>
                    <span className="perk-reward-card__label">{reward.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="perk-sidebar">
          <EggInventoryPanel inventory={status?.eggInventory} pulseTier={eggPulseTier} />

          <div className="perk-tokens-panel">
            <div className="perk-tokens-panel__title">🎁 Inventory</div>
            <ul className="perk-tokens-list">
              <li>⚡ 1.5× BP XP Tokens: <strong>{status?.tokens?.battlePassXp15 ?? 0}</strong></li>
              <li>✨ 1.5× Savvy Tokens: <strong>{status?.tokens?.savvyMultiplier15 ?? 0}</strong></li>
              <li>🛡️ Streak Shields: <strong>{status?.streakShields ?? 0}</strong></li>
              <li>🎖️ Calling Cards: <strong>{status?.callingCardDrops ?? 0}</strong></li>
            </ul>
          </div>

          {status?.recentSpins?.length ? (
            <div className="perk-history-panel">
              <div className="perk-history-panel__title">Recent Spins</div>
              <ul className="perk-history-list">
                {status.recentSpins.slice(0, 6).map((spin) => (
                  <li key={spin.spinId}>
                    <span className="perk-history-list__mode">{spin.mode}</span>
                    <span className="perk-history-list__rewards">
                      {(spin.rewards || []).map((r) => r.label).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <EggHatchery
        eggInventory={status?.eggInventory}
        onHatch={handleHatch}
        onStatusUpdate={handleHatchStatusUpdate}
        onSpinClick={scrollToMachine}
      />

      {showAdmin ? (
        <PerkMachineAdminPanel onStatusRefresh={loadStatus} />
      ) : null}

      <footer className="perk-footer">
        <Final10Slogan variant="footer" />
      </footer>
    </div>
  );
}
