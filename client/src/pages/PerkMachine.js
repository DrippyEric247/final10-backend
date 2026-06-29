import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getPerkMachineStatus,
  spinPerkMachine,
  hatchPerkEgg,
  activatePerkItem,
  checkPerkMachineAdminAccess,
} from '../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST, useSavvyPoints } from '../store/savvyStore';
import { shouldShowAdminNav } from '../lib/adminAccess';
import { isRateLimitError } from '../lib/apiErrorParsing';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import PerkMachineAdminPanel from '../components/perk/PerkMachineAdminPanel';
import PerkMachineScoutFloater from '../components/perk/PerkMachineScoutFloater';
import PerkMachineEnvironment from '../components/perk/PerkMachineEnvironment';
import EggHatchery from '../components/perk/EggHatchery';
import { SavvySalePerkBadge } from '../components/events/SavvySaleBanner';
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

function prettyMode(mode) {
  if (!mode) return 'SPIN';
  if (mode.startsWith('hatch_')) return `HATCH · ${mode.slice(6).toUpperCase()}`;
  return mode.toUpperCase();
}

/** Inventory items the player can activate, with copy for the activation modal. */
const ACTIVATABLE_DEFS = [
  {
    key: 'battlePassXp15',
    icon: '⚡',
    label: '1.5× Battle Pass XP Token',
    effect: 'Activates a 1.5× Battle Pass XP boost for the next 24 hours.',
    countFrom: (s) => Number(s?.tokens?.battlePassXp15) || 0,
  },
  {
    key: 'savvyMultiplier15',
    icon: '✨',
    label: '1.5× Savvy Token',
    effect: 'Activates a 1.5× Savvy boost on Perk Machine rewards for 24 hours.',
    countFrom: (s) => Number(s?.tokens?.savvyMultiplier15) || 0,
  },
  {
    key: 'extraFreeSpin',
    icon: '🎰',
    label: 'Extra Free Spin Egg',
    effect: 'Adds one free Perk Machine spin right now.',
    countFrom: (s) => Number(s?.eggInventory?.extraFreeSpin) || 0,
  },
];

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
  const [lastSummary, setLastSummary] = useState(null);
  const [confirmToast, setConfirmToast] = useState(null);
  const [coinBurst, setCoinBurst] = useState(0);
  const [activationItem, setActivationItem] = useState(null);
  const [activating, setActivating] = useState(false);
  const [boostNow, setBoostNow] = useState(Date.now());
  const [saleMs, setSaleMs] = useState(0);
  const spinLock = useRef(false);
  const machinePanelRef = useRef(null);
  const toastTimer = useRef(null);

  const showConfirm = useCallback((message, tone = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setConfirmToast({ message, tone, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setConfirmToast(null), 2800);
  }, []);

  const fireCoinBurst = useCallback(() => {
    setCoinBurst((n) => n + 1);
    setBalanceBump(true);
    window.setTimeout(() => setBalanceBump(false), 1400);
  }, []);

  useEffect(() => {
    if (!status?.savvySale?.active) return undefined;
    setSaleMs(status.savvySale.msRemaining || 0);
    const tick = setInterval(() => setSaleMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(tick);
  }, [status?.savvySale?.eventId, status?.savvySale?.active, status?.savvySale?.msRemaining]);

  const paidCosts = useMemo(() => {
    const costs = status?.spinCosts || {};
    return {
      paid_1: costs.paid_1?.savvy ?? 20,
      paid_2: costs.paid_2?.savvy ?? 40,
      paid_3: costs.paid_3?.savvy ?? 60,
      orig_1: costs.paid_1?.originalSavvy ?? 20,
      orig_2: costs.paid_2?.originalSavvy ?? 40,
      orig_3: costs.paid_3?.originalSavvy ?? 60,
      sale: Boolean(costs.paid_1?.saleApplied || status?.savvySale?.active),
    };
  }, [status?.spinCosts, status?.savvySale?.active]);

  function renderSpinPrice(mode, fallback) {
    const cost = paidCosts[mode] ?? fallback;
    const orig = paidCosts[`orig_${mode.split('_')[1]}`] ?? fallback;
    if (paidCosts.sale && orig > cost) {
      return (
        <span className="perk-spin-price--sale">
          <span className="perk-spin-price__original">{orig} Savvy</span>
          <span className="perk-spin-price__sale">{cost} Savvy · {mode === 'paid_1' ? '1' : mode === 'paid_2' ? '2' : '3'} Slot{mode === 'paid_1' ? '' : 's'}</span>
        </span>
      );
    }
    return `${cost} Savvy · ${mode === 'paid_1' ? '1 Slot' : mode === 'paid_2' ? '2 Slots' : '3 Slots'}`;
  }

  const loadStatus = useCallback(async () => {
    try {
      const data = await getPerkMachineStatus();
      setStatus(data);
      setError('');
      return data;
    } catch (e) {
      if (!isRateLimitError(e)) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load Perk Machine.');
      }
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

  // Tick every second so Active Boosts timers count down live.
  useEffect(() => {
    if (!status?.activeBoosts?.length) return undefined;
    const id = window.setInterval(() => setBoostNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status?.activeBoosts?.length]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

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

  const runRevealSequence = useCallback((rewards, message, onComplete) => {
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
            if (typeof onComplete === 'function') onComplete();
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
        const spinCost = Number(result?.summary?.cost ?? result?.savvyCost ?? 0);
        const netSavvy = Number(result?.summary?.net ?? savvyWin - spinCost);
        const eggsAdded = Array.isArray(result?.summary?.eggs)
          ? result.summary.eggs
          : rewards.filter((r) => r.type === 'egg').map((r) => r.label);
        setLastSummary({ cost: spinCost, savvyWon: savvyWin, net: netSavvy, eggs: eggsAdded });

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

        runRevealSequence(
          rewards,
          result.message || result.resultMessage || 'Nice pull, Operator.',
          () => {
            if (savvyWin > 0) {
              fireCoinBurst();
              showConfirm(`+${savvyWin.toLocaleString()} Savvy added to wallet`);
            } else {
              showConfirm('Balance updated');
            }
          }
        );
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Spin failed.';
        setError(msg);
        setSpinning(false);
        setReelPhase('idle');
        spinLock.current = false;
      }
    },
    [refreshProfile, runRevealSequence, spinning, status, patchUser, user, savvyBalance, fireCoinBurst, showConfirm]
  );

  const handleHatch = useCallback(
    async (eggTier) => {
      const balanceBefore = savvyBalance;
      const result = await hatchPerkEgg(eggTier);
      if (result?.status) setStatus(result.status);
      const savvyGranted = Number(result?.reward?.savvyGranted) || 0;
      if (savvyGranted > 0) {
        fireCoinBurst();
        showConfirm(`+${savvyGranted.toLocaleString()} Savvy added to wallet`);
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
    [refreshProfile, patchUser, user, savvyBalance, fireCoinBurst, showConfirm]
  );

  const handleActivate = useCallback(
    async (itemKey) => {
      if (activating) return;
      setActivating(true);
      try {
        const result = await activatePerkItem(itemKey);
        if (result?.status) setStatus(result.status);
        if (typeof refreshProfile === 'function') await refreshProfile();
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        const label = result?.item?.label || 'Boost';
        showConfirm(
          result?.freeSpins
            ? `${label} activated — free spin ready`
            : `${label} activated`
        );
        setActivationItem(null);
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Activation failed.';
        showConfirm(msg, 'error');
      } finally {
        setActivating(false);
      }
    },
    [activating, refreshProfile, showConfirm]
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
        <LoadingState label="Powering up Savvy Perk Machine…" />
      </div>
    );
  }

  const freeReady = Boolean(status?.freeSpinAvailable);
  const tierLabel = status?.subscriptionLabel || 'Free';
  const operatorLevel = tierLabel === 'Free' ? 'Free Operator' : `${tierLabel} Operator`;
  const multiplier = tierLabel === 'Pro' || tierLabel === 'Premium' ? '1.50x' : '1.00x';

  return (
    <div className={`perk-page ${status?.savvySale?.active ? 'perk-page--savvy-sale' : ''}`}>
      <div className="perk-page__glow" aria-hidden />

      {coinBurst > 0 ? (
        <div className="perk-coin-fx" key={coinBurst} aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="perk-coin-fx__coin" style={{ '--i': i }}>
              🪙
            </span>
          ))}
        </div>
      ) : null}

      {confirmToast ? (
        <div
          className={`perk-confirm-toast perk-confirm-toast--${confirmToast.tone}`}
          role="status"
          key={confirmToast.id}
        >
          <span aria-hidden>{confirmToast.tone === 'error' ? '⚠️' : '✅'}</span>
          {confirmToast.message}
        </div>
      ) : null}

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
          <SavvySalePerkBadge sale={status?.savvySale} msRemaining={saleMs} scoutLine />
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
              disabled={spinning || savvyBalance < paidCosts.paid_1}
              onClick={() => void handleSpin('paid_1')}
            >
              {renderSpinPrice('paid_1', 20)}
            </button>
            <button
              type="button"
              className="perk-btn perk-btn--slot2"
              disabled={spinning || savvyBalance < paidCosts.paid_2}
              onClick={() => void handleSpin('paid_2')}
            >
              {renderSpinPrice('paid_2', 40)}
            </button>
            <button
              type="button"
              className="perk-btn perk-btn--slot3"
              disabled={spinning || savvyBalance < paidCosts.paid_3}
              onClick={() => void handleSpin('paid_3')}
            >
              {renderSpinPrice('paid_3', 60)}
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
                    {reward.savvyBoosted ? <span className="perk-reward-card__boost">1.5× boost</span> : null}
                  </div>
                ))}
              </div>

              {lastSummary ? (
                <div className="perk-net-summary" aria-label="Spin reward summary">
                  <div className="perk-net-summary__row">
                    <span>Cost</span>
                    <span className="perk-net-summary__cost">
                      {lastSummary.cost > 0 ? `-${lastSummary.cost.toLocaleString()}` : '0'} Savvy
                    </span>
                  </div>
                  <div className="perk-net-summary__row">
                    <span>Rewards</span>
                    <span className="perk-net-summary__rewards">
                      {lastSummary.savvyWon > 0 ? `+${lastSummary.savvyWon.toLocaleString()} Savvy` : '—'}
                    </span>
                  </div>
                  <div className="perk-net-summary__row perk-net-summary__row--net">
                    <span>Net</span>
                    <span className={lastSummary.net >= 0 ? 'perk-net-summary__pos' : 'perk-net-summary__neg'}>
                      {lastSummary.net >= 0 ? '+' : ''}
                      {lastSummary.net.toLocaleString()} Savvy
                    </span>
                  </div>
                  {lastSummary.eggs?.length ? (
                    <div className="perk-net-summary__row">
                      <span>Eggs</span>
                      <span className="perk-net-summary__eggs">{lastSummary.eggs.join(', ')} added</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="perk-sidebar">
          <EggInventoryPanel inventory={status?.eggInventory} pulseTier={eggPulseTier} />

          {(() => {
            const boosts = status?.activeBoosts || [];
            const shields = Number(status?.streakShields) || 0;
            const scoutBoosts = Number(status?.scoutUpgrades) || 0;
            if (!boosts.length && !shields && !scoutBoosts) return null;
            return (
              <div className="perk-boosts-panel">
                <div className="perk-boosts-panel__title">⚡ Active Boosts</div>
                <ul className="perk-boosts-list">
                  {boosts.map((b) => {
                    const ended = new Date(b.expiresAt).getTime() - boostNow <= 0;
                    return (
                      <li key={b.key} className="perk-boost-row perk-boost-row--timed">
                        <span className="perk-boost-row__label">
                          {b.icon} {b.label}
                        </span>
                        <span className="perk-boost-row__timer">
                          {ended ? 'Ending…' : formatCountdown(b.expiresAt)}
                        </span>
                      </li>
                    );
                  })}
                  {shields > 0 ? (
                    <li className="perk-boost-row">
                      <span className="perk-boost-row__label">🛡️ Streak Shield</span>
                      <span className="perk-boost-row__count">{shields} available</span>
                    </li>
                  ) : null}
                  {scoutBoosts > 0 ? (
                    <li className="perk-boost-row">
                      <span className="perk-boost-row__label">🤖 Scout Boost</span>
                      <span className="perk-boost-row__count">{scoutBoosts} active</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })()}

          <div className="perk-tokens-panel">
            <div className="perk-tokens-panel__title">🎁 Inventory</div>
            <ul className="perk-tokens-list">
              {ACTIVATABLE_DEFS.map((def) => {
                const count = def.countFrom(status);
                return (
                  <li key={def.key} className="perk-inv-item">
                    <span className="perk-inv-item__label">
                      {def.icon} {def.label}
                    </span>
                    <span className="perk-inv-item__right">
                      <strong>{count}</strong>
                      <button
                        type="button"
                        className="perk-inv-item__use"
                        disabled={count < 1}
                        onClick={() => setActivationItem({ ...def, count })}
                      >
                        Use
                      </button>
                    </span>
                  </li>
                );
              })}
              <li className="perk-inv-item perk-inv-item--passive">
                <span className="perk-inv-item__label">🛡️ Streak Shields</span>
                <span className="perk-inv-item__right"><strong>{status?.streakShields ?? 0}</strong></span>
              </li>
              <li className="perk-inv-item perk-inv-item--passive">
                <span className="perk-inv-item__label">🎖️ Calling Cards</span>
                <span className="perk-inv-item__right"><strong>{status?.callingCardDrops ?? 0}</strong></span>
              </li>
            </ul>
          </div>

          {status?.recentSpins?.length ? (
            <div className="perk-history-panel">
              <div className="perk-history-panel__title">Recent Spins</div>
              <ul className="perk-history-list">
                {status.recentSpins.slice(0, 6).map((spin) => {
                  const cost = Number(spin.savvyCost) || 0;
                  const won = Number(spin.savvyWon) || 0;
                  const net = spin.net != null ? Number(spin.net) : won - cost;
                  const rewardLabels = (spin.rewards || []).map((r) => r.label).join(', ') || '—';
                  return (
                    <li key={spin.spinId} className="perk-history-item">
                      <span className="perk-history-item__mode">{prettyMode(spin.mode)}</span>
                      <span className="perk-history-item__line">
                        Cost: <span className="perk-history-item__cost">{cost > 0 ? `-${cost}` : '0'}</span> ·
                        {' '}Rewards: <span className="perk-history-item__rewards">{rewardLabels}</span>
                      </span>
                      <span className={`perk-history-item__net ${net >= 0 ? 'is-pos' : 'is-neg'}`}>
                        Net: {net >= 0 ? '+' : ''}{net} Savvy
                      </span>
                    </li>
                  );
                })}
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

      {activationItem ? (
        <div
          className="perk-activate-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Activate boost"
          onClick={() => !activating && setActivationItem(null)}
        >
          <div className="perk-activate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="perk-activate-modal__icon" aria-hidden>{activationItem.icon}</div>
            <h3 className="perk-activate-modal__title">Activate this boost?</h3>
            <p className="perk-activate-modal__name">{activationItem.label}</p>
            <p className="perk-activate-modal__effect">{activationItem.effect}</p>
            <p className="perk-activate-modal__count">You have {activationItem.count} available.</p>
            <div className="perk-activate-modal__actions">
              <button
                type="button"
                className="perk-activate-modal__cancel"
                disabled={activating}
                onClick={() => setActivationItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="perk-activate-modal__confirm"
                disabled={activating}
                onClick={() => void handleActivate(activationItem.key)}
              >
                {activating ? 'Activating…' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="perk-footer">
        <Final10Slogan variant="footer" />
      </footer>
    </div>
  );
}
