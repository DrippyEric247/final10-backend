import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applyServerSavvyBalance } from '../lib/applyServerSavvyBalance';
import {
  getPerkMachineStatus,
  spinPerkMachine,
  hatchPerkEgg,
  activateInventoryToken,
  activatePerkEventToken,
  activateMaxSupplyDropToken,
  redeemBattlePassTierSkip,
  checkPerkMachineAdminAccess,
} from '../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST, useSavvyPoints } from '../store/savvyStore';
import { useCosmeticsLoadout } from '../context/CosmeticsContext';
import { shouldShowAdminNav } from '../lib/adminAccess';
import { isRateLimitError } from '../lib/apiErrorParsing';
import { formatPerkMachineSpinError } from '../lib/perkMachineErrors';
import { useLiveEventsOptional, LIVE_EVENTS_HUB_UPDATED } from '../context/LiveEventsContext';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import PerkMachineAdminPanel from '../components/perk/PerkMachineAdminPanel';
import PerkMachineScoutFloater from '../components/perk/PerkMachineScoutFloater';
import PerkMachineEnvironment from '../components/perk/PerkMachineEnvironment';
import EggHatchery from '../components/perk/EggHatchery';
import PerkMachineTournamentProgress from '../components/perk/PerkMachineTournamentProgress';
import PerkRewardIndexModal from '../components/perk/PerkRewardIndexModal';
import PerkRewardReveal from '../components/perk/PerkRewardReveal';
import { showCallingCardUnlock } from '../lib/callingCardUnlockBus';
import { pickHeroReveal } from '../lib/rewardRevealThemes';
import { isFirstRevealOfKey, markRevealKeySeen } from '../lib/perkRevealSeen';
import { setPermanentPowerBonus } from '../lib/final10PowerEngine';
import {
  playPerkLegendaryRewardSound,
  playPerkMachineSpinSound,
  playPerkMultiplierActivationSound,
  playPerkReelStopSound,
  playPerkRewardRevealSound,
  playPerkScoutFlightTicketSound,
  stopPerkMachineSfx,
} from '../lib/perkMachineSfx';
import {
  duckPerkMusicForDuration,
  PERK_MUSIC_DUCK,
} from '../lib/perkMachineMusicEngine';
import { SavvySalePerkBadge } from '../components/events/SavvySaleBanner';
import TokenActivationModal from '../components/inventory/TokenActivationModal';
import {
  INVENTORY_TOKEN_DEFS,
  isBoostActiveForDef,
} from '../lib/inventoryTokens';
import { celebrateBattlePassXp, emitProgressionCelebration } from '../lib/progressionCelebrationBus';
import {
  createActivationIdempotencyKey,
  stashActivationPresentation,
} from '../lib/inventoryActivationBus';
import { notifyInventoryUpdated } from '../hooks/useActiveBoosts';
import '../styles/InventoryTokens.css';
import '../styles/PerkMachine.css';
import '../styles/EggHatchery.css';
import '../styles/PerkRewardIndex.css';

const REEL_SYMBOLS = ['🪙', '💰', '🥚', '⚡', '✨', '🛡️', '🎖️', '🎰', '💎', '🔥', '⭐', '🎟', '📦'];

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

function rarityClass(rarity, type) {
  if (type === 'multiplier_2x') return 'perk-reward--multiplier';
  if (rarity === 'legendary') return 'perk-reward--legendary';
  if (rarity === 'epic') return 'perk-reward--epic';
  if (rarity === 'rare') return 'perk-reward--rare';
  if (rarity === 'uncommon') return 'perk-reward--uncommon';
  return 'perk-reward--common';
}

function prettyMode(mode) {
  if (!mode) return 'SPIN';
  if (mode.startsWith('hatch_')) return `HATCH · ${mode.slice(6).toUpperCase()}`;
  return mode.toUpperCase();
}


function ReelColumn({ spinning, symbol, revealed, highlight, isMultiplier }) {
  return (
    <div
      className={`perk-reel ${spinning ? 'perk-reel--spinning' : ''} ${revealed ? 'perk-reel--revealed' : ''} ${
        highlight ? 'perk-reel--win' : ''
      } ${isMultiplier ? 'perk-reel--multiplier' : ''}`}
      title={isMultiplier ? 'Doubles other rewards in this spin.' : undefined}
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

function formatRemaining(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m left`;
  }
  return `${m}m ${String(s).padStart(2, '0')}s left`;
}

/** Panel for hatch-earned usable rewards: timed tokens, supply drops, tier skips. */
function HatchRewardsInventory({ status, onActivateEvent, onMaxSupplyDrop, onTierSkip, busy }) {
  const tokens = status?.tokens || {};
  const timedTokens = Array.isArray(status?.timedEventTokens) ? status.timedEventTokens : [];
  const activeEvents = Array.isArray(status?.personalEvents) ? status.personalEvents : [];
  const maxSupplyDrop = Number(tokens.maxSupplyDrop) || 0;
  const tierSkips = Number(tokens.battlePassTierSkip) || 0;
  const twoSlotSpins = Number(tokens.paid2Spin) || 0;
  const guaranteed = Number(status?.nextSpinGuaranteedMultiplier) || 0;

  const hasAnything =
    timedTokens.length > 0 ||
    activeEvents.length > 0 ||
    maxSupplyDrop > 0 ||
    tierSkips > 0 ||
    twoSlotSpins > 0 ||
    guaranteed > 0;

  if (!hasAnything) return null;

  return (
    <div className="perk-hatch-inv">
      <div className="perk-hatch-inv__title">🎁 Reward Inventory</div>

      {guaranteed > 0 ? (
        <div className="perk-hatch-inv__note">
          ⭐ Guaranteed {guaranteed}× is armed for your next spin.
        </div>
      ) : null}
      {twoSlotSpins > 0 ? (
        <div className="perk-hatch-inv__note">
          🎰 {twoSlotSpins} free two-slot spin{twoSlotSpins === 1 ? '' : 's'} — used automatically on 2-slot spins.
        </div>
      ) : null}

      {activeEvents.length > 0 ? (
        <div className="perk-hatch-inv__active">
          {activeEvents.map((e) => (
            <span key={e.kind} className="perk-hatch-inv__active-pill">
              {e.icon} {e.label} · {formatRemaining(e.remainingMs)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="perk-hatch-inv__grid">
        {timedTokens.map((t) => (
          <div key={t.id} className="perk-hatch-inv__item">
            <span className="perk-hatch-inv__item-icon" aria-hidden>{t.icon}</span>
            <span className="perk-hatch-inv__item-label">{t.label}</span>
            <button
              type="button"
              className="perk-hatch-inv__use"
              disabled={busy}
              onClick={() => void onActivateEvent(t.id)}
            >
              Activate
            </button>
          </div>
        ))}

        {maxSupplyDrop > 0 ? (
          <div className="perk-hatch-inv__item">
            <span className="perk-hatch-inv__item-icon" aria-hidden>📦</span>
            <span className="perk-hatch-inv__item-label">
              Max Supply Drop Token ×{maxSupplyDrop}
              {status?.nextSupplyDropDouble ? ' (next pays double)' : ''}
            </span>
            <button
              type="button"
              className="perk-hatch-inv__use"
              disabled={busy}
              onClick={() => void onMaxSupplyDrop()}
            >
              Deploy
            </button>
          </div>
        ) : null}

        {tierSkips > 0 ? (
          <div className="perk-hatch-inv__item">
            <span className="perk-hatch-inv__item-icon" aria-hidden>⏭️</span>
            <span className="perk-hatch-inv__item-label">Battle Pass Tier Skip ×{tierSkips}</span>
            <button
              type="button"
              className="perk-hatch-inv__use"
              disabled={busy}
              onClick={() => void onTierSkip()}
            >
              Skip Tier
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PerkMachine() {
  const navigate = useNavigate();
  const { user, refreshProfile, patchUser } = useAuth();
  const cosmetics = useCosmeticsLoadout();
  const savvy = useSavvyPoints();
  const liveEvents = useLiveEventsOptional();
  const showAdminDetail = shouldShowAdminNav(user) || process.env.NODE_ENV !== 'production';
  const hubSaleActive = Boolean(
    liveEvents?.hub?.timers?.savvySale?.active || liveEvents?.hub?.raw?.savvySale?.active
  );
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
  const [activatingKey, setActivatingKey] = useState(null);
  const [activating, setActivating] = useState(false);
  const [boostNow, setBoostNow] = useState(Date.now());
  const [saleMs, setSaleMs] = useState(0);
  const [ticketProgressPulse, setTicketProgressPulse] = useState(false);
  const [ticketUnlock, setTicketUnlock] = useState(null);
  const [directTicketAward, setDirectTicketAward] = useState(null);
  const [showRewardIndex, setShowRewardIndex] = useState(false);
  const [resolvedRewards, setResolvedRewards] = useState([]);
  const [lastMultiplier, setLastMultiplier] = useState(null);
  const [multiplierPulse, setMultiplierPulse] = useState(false);
  const [heroReveal, setHeroReveal] = useState(null);
  const spinLock = useRef(false);
  const machinePanelRef = useRef(null);
  const toastTimer = useRef(null);

  const showConfirm = useCallback((message, tone = 'success') => {
    duckPerkMusicForDuration(PERK_MUSIC_DUCK.REWARD, 2800);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setConfirmToast({ message, tone, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setConfirmToast(null), 2800);
  }, []);

  const fireCoinBurst = useCallback(() => {
    setCoinBurst((n) => n + 1);
    setBalanceBump(true);
    window.setTimeout(() => setBalanceBump(false), 1400);
  }, []);

  const showDirectTicketAward = useCallback((ticketResult, statusAfter) => {
    const granted = Number(ticketResult?.ticketsGranted) || 0;
    if (granted < 1) return;
    void playPerkScoutFlightTicketSound();
    setDirectTicketAward({
      id: Date.now(),
      ticketsGranted: granted,
      ticketsOwned: statusAfter?.tournamentTicketProgress?.ticketsOwned ?? granted,
    });
    window.setTimeout(() => setDirectTicketAward(null), 4200);
  }, []);
  const showTicketUnlock = useCallback((ticketResult) => {
    if (!ticketResult?.ticketEarned) return;
    void playPerkScoutFlightTicketSound();
    setTicketUnlock({
      id: Date.now(),
      ticketsEarned: ticketResult.ticketsEarned || 1,
      ticketsOwned: ticketResult.tournamentTicketProgress?.ticketsOwned ?? 1,
    });
    setTicketProgressPulse(true);
    window.setTimeout(() => setTicketProgressPulse(false), 1800);
    window.setTimeout(() => setTicketUnlock(null), 4200);
  }, []);

  useEffect(() => {
    const saleActive = Boolean(status?.savvySale?.active || hubSaleActive);
    if (!saleActive) return undefined;
    const ms =
      status?.savvySale?.msRemaining ??
      liveEvents?.hub?.timers?.savvySale?.msRemaining ??
      0;
    setSaleMs(ms);
    const tick = setInterval(() => setSaleMs((prev) => Math.max(0, prev - 1000)), 1000);
    return () => clearInterval(tick);
  }, [
    status?.savvySale?.eventId,
    status?.savvySale?.active,
    status?.savvySale?.msRemaining,
    hubSaleActive,
    liveEvents?.hub?.timers?.savvySale?.eventId,
    liveEvents?.hub?.timers?.savvySale?.msRemaining,
  ]);

  const savvySaleDisplay = useMemo(() => {
    if (status?.savvySale?.active) {
      return { ...status.savvySale, active: true, msRemaining: saleMs || status.savvySale.msRemaining || 0 };
    }
    if (hubSaleActive) {
      return {
        active: true,
        msRemaining: saleMs || liveEvents?.hub?.timers?.savvySale?.msRemaining || 0,
      };
    }
    return status?.savvySale || null;
  }, [status?.savvySale, hubSaleActive, saleMs, liveEvents?.hub?.timers?.savvySale?.msRemaining]);

  const paidCosts = useMemo(() => {
    const costs = status?.spinCosts || {};
    const sale = Boolean(costs.paid_1?.saleApplied || status?.savvySale?.active || hubSaleActive);
    const base = {
      paid_1: costs.paid_1?.originalSavvy ?? costs.paid_1?.savvy ?? 20,
      paid_2: costs.paid_2?.originalSavvy ?? costs.paid_2?.savvy ?? 40,
      paid_3: costs.paid_3?.originalSavvy ?? costs.paid_3?.savvy ?? 60,
    };
    const half = (n) => Math.max(0, Math.round(n / 2));
    return {
      paid_1: sale ? (costs.paid_1?.savvy ?? half(base.paid_1)) : (costs.paid_1?.savvy ?? 20),
      paid_2: sale ? (costs.paid_2?.savvy ?? half(base.paid_2)) : (costs.paid_2?.savvy ?? 40),
      paid_3: sale ? (costs.paid_3?.savvy ?? half(base.paid_3)) : (costs.paid_3?.savvy ?? 60),
      orig_1: base.paid_1,
      orig_2: base.paid_2,
      orig_3: base.paid_3,
      sale,
    };
  }, [status?.spinCosts, status?.savvySale?.active, hubSaleActive]);

  function renderSpinPrice(mode, fallback) {
    const slotLabel =
      mode === 'paid_1' ? '1 Slot' : mode === 'paid_2' ? '2 Slots' : '3 Slots';
    const cost = paidCosts[mode] ?? fallback;
    const orig = paidCosts[`orig_${mode.split('_')[1]}`] ?? fallback;
    if (paidCosts.sale && orig > cost) {
      return (
        <span className="perk-spin-price--sale">
          <span className="perk-spin-price__row">
            <span className="perk-spin-price__original">{orig} Savvy</span>
            <span className="perk-spin-price__arrow" aria-hidden>
              →
            </span>
            <span className="perk-spin-price__sale">{cost} Savvy</span>
          </span>
          <span className="perk-spin-price__slots">{slotLabel}</span>
        </span>
      );
    }
    return `${cost} Savvy · ${slotLabel}`;
  }

  const loadStatus = useCallback(async () => {
    try {
      const data = await getPerkMachineStatus();
      setStatus(data);
      if (data && typeof data.powerMultiplierBonus === 'number') {
        setPermanentPowerBonus(data.powerMultiplierBonus);
      }
      setError('');
      return data;
    } catch (e) {
      if (!isRateLimitError(e)) {
        setError(formatPerkMachineSpinError(e, { showAdminDetail }));
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [showAdminDetail]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onHub = () => {
      void loadStatus();
    };
    window.addEventListener(LIVE_EVENTS_HUB_UPDATED, onHub);
    return () => window.removeEventListener(LIVE_EVENTS_HUB_UPDATED, onHub);
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
        void playPerkReelStopSound();
        if (i < rewards.length) {
          window.setTimeout(step, 900);
        } else {
          window.setTimeout(() => {
            setReelPhase('complete');
            setResultMessage(message);
            setSpinning(false);
            spinLock.current = false;
            void playPerkRewardRevealSound();
            duckPerkMusicForDuration(PERK_MUSIC_DUCK.SPIN_COMPLETE, 2600);
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
      void playPerkMachineSpinSound();
      setError('');
      setResultMessage('');
      setResolvedRewards([]);
      setLastMultiplier(null);
      setReelPhase('spinning');
      setDisplayRewards([]);
      setRevealedCount(0);

      const balanceBefore = savvyBalance;
      try {
        const result = await spinPerkMachine(mode);
        const rewards = Array.isArray(result.rewards) ? result.rewards : [];
        const rawForReels =
          Array.isArray(result.rawRewards) && result.rawRewards.length ? result.rawRewards : rewards;
        setStatus(result.status || status);
        setLastMultiplier(result.multiplier || null);

        const eggWin = rewards.find((r) => r.type === 'egg' && !r.multiplierRole);
        if (eggWin?.eggTier) {
          setEggPulseTier(eggWin.eggTier);
          window.setTimeout(() => setEggPulseTier(null), 2400);
        }

        const savvyWin = rewards.reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
        const spinCost = Number(
          result?.actualCostCharged ?? result?.summary?.actualCostCharged ?? result?.summary?.cost ?? result?.savvyCost ?? 0
        );
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
          applyServerSavvyBalance(patchUser, nextBalance, {
            source: 'perk_machine_spin',
            oldValue: balanceBefore,
          });
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
          rawForReels,
          result.message || result.resultMessage || 'Nice pull, Operator.',
          () => {
            setResolvedRewards(rewards);
            const multFactor = Number(result.multiplier?.factor) || 1;
            const isLegendary = rewards.some(
              (r) => r.rarity === 'legendary' || r.eggTier === 'legendary'
            );
            if (isLegendary) {
              void playPerkLegendaryRewardSound();
            }
            if (result.multiplier?.isJackpot) {
              duckPerkMusicForDuration(PERK_MUSIC_DUCK.JACKPOT, 4200);
            }
            if (multFactor > 1) {
              void playPerkMultiplierActivationSound(multFactor);
              setMultiplierPulse(true);
              window.setTimeout(() => setMultiplierPulse(false), 2200);
            }

            const directTickets = Number(result.summary?.directTicketsWon) || 0;
            if (directTickets > 0) {
              showDirectTicketAward({ ticketsGranted: directTickets }, result.status);
            } else if (result.tournamentTicket?.ticketEarned) {
              showTicketUnlock(result.tournamentTicket);
            } else if (result.status?.tournamentTicketProgress) {
              setTicketProgressPulse(true);
              window.setTimeout(() => setTicketProgressPulse(false), 700);
            }
            if (savvyWin > 0) {
              fireCoinBurst();
              showConfirm(`+${savvyWin.toLocaleString()} Savvy added to wallet`);
            } else if (!result.tournamentTicket?.ticketEarned && directTickets < 1) {
              showConfirm('Balance updated');
            }

            // Calling card → full unlock ceremony (or duplicate → Savvy).
            const cardReward = rewards.find(
              (r) => r.type === 'calling_card' && r.callingCardId
            );
            if (cardReward) {
              // Refresh the cosmetics cache so the collection + NEW ribbon reflect the grant.
              if (typeof cosmetics?.reload === 'function') void cosmetics.reload();
              window.setTimeout(() => {
                showCallingCardUnlock({
                  cardId: cardReward.callingCardId,
                  trigger: 'perk_machine_spin',
                  duplicate: Boolean(cardReward.callingCardDuplicate),
                  duplicateSavvy: Number(cardReward.duplicateSavvy) || 0,
                  unlockReason: cardReward.callingCardDuplicate
                    ? ''
                    : cardReward.callingCardTagline || '',
                });
              }, 450);
            } else {
              // Otherwise, give the top non-card reward its own themed reveal.
              // Big rewards get the cinematic overlay; common rewards get a
              // fast ~1s glow-and-fly chip. Any first-ever unlock is promoted
              // to cinematic once, then stays quick after that.
              const hero = pickHeroReveal(rewards);
              if (hero) {
                const firstEver = isFirstRevealOfKey(hero.key);
                markRevealKeySeen(hero.key);
                const mode = firstEver ? 'cinematic' : hero.mode || 'quick';
                window.setTimeout(() => setHeroReveal({ ...hero, mode, id: Date.now() }), 400);
              }
            }
          }
        );
      } catch (e) {
        const msg = formatPerkMachineSpinError(e, { showAdminDetail });
        stopPerkMachineSfx();
        setError(msg);
        if (showAdminDetail) {
          // eslint-disable-next-line no-console
          console.error('[perk-machine/spin]', e?.response?.data?.detail || e?.response?.data || e);
        }
        setSpinning(false);
        setReelPhase('idle');
        spinLock.current = false;
      }
    },
    [refreshProfile, runRevealSequence, spinning, status, patchUser, user, savvyBalance, fireCoinBurst, showConfirm, showTicketUnlock, showDirectTicketAward, showAdminDetail, cosmetics]
  );

  const handleHatch = useCallback(
    async (eggTier) => {
      const balanceBefore = savvyBalance;
      const result = await hatchPerkEgg(eggTier);
      if (result?.status) setStatus(result.status);
      const reward = result?.reward || {};
      const savvyGranted = Number(reward.savvyGranted) || 0;
      if (savvyGranted > 0) {
        fireCoinBurst();
        showConfirm(`+${savvyGranted.toLocaleString()} Savvy added to wallet`);
      }

      // Permanent top-bar multiplier → reflect immediately.
      if (
        reward.type === 'permanent_multiplier' &&
        typeof result?.status?.powerMultiplierBonus === 'number'
      ) {
        setPermanentPowerBonus(result.status.powerMultiplierBonus);
      }

      // Calling card → full unlock ceremony (shows the actual card name).
      if (reward.type === 'calling_card' && reward.callingCardId) {
        if (typeof cosmetics?.reload === 'function') void cosmetics.reload();
        window.setTimeout(() => {
          showCallingCardUnlock({
            cardId: reward.callingCardId,
            trigger: 'egg_hatch',
            duplicate: Boolean(reward.callingCardDuplicate),
            duplicateSavvy: Number(reward.duplicateSavvy) || 0,
            unlockReason: reward.callingCardDuplicate ? '' : reward.callingCardTagline || '',
          });
        }, 500);
      }

      const nextBalance = Math.round(
        Number(result?.savvyBalance ?? result?.status?.savvyBalance ?? user?.savvyPoints ?? 0)
      );
      if (typeof patchUser === 'function') {
        applyServerSavvyBalance(patchUser, nextBalance, {
          source: 'perk_machine_hatch',
          oldValue: balanceBefore,
        });
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
    [refreshProfile, patchUser, user, savvyBalance, fireCoinBurst, showConfirm, cosmetics]
  );

  const tokenActivating = Boolean(activatingKey);

  const handleActivate = useCallback(
    async (def) => {
      if (!def || activatingKey) return;
      setActivatingKey(def.itemType);
      const idempotencyKey = createActivationIdempotencyKey(def.itemType);
      try {
        const result = await activateInventoryToken(def.itemType, idempotencyKey);
        if (!result?.success || !result?.consumed) {
          throw new Error(result?.message || 'Token could not be activated. Nothing was consumed.');
        }
        if (result?.status) setStatus(result.status);
        if (typeof refreshProfile === 'function') await refreshProfile();
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        notifyInventoryUpdated();

        stashActivationPresentation({
          itemType: def.itemType,
          navigationTarget: result.navigationTarget || def.navigationTarget,
          activation: result.activation,
          presentation: result.presentation,
          freeSpinsTotal: result.freeSpinsTotal,
          pendingXpBreakdown: result.pendingXpBreakdown,
          streakShield: result.streakShield,
          autoSpin: result.autoSpin,
        });

        if (result.pendingXpBreakdown?.totalXp) {
          if (def.itemType === 'battle_pass_xp_token') {
            celebrateBattlePassXp(result.pendingXpBreakdown.totalXp, { source: 'inventory_token' });
          } else if (def.itemType === 'savvy_level_xp_token') {
            emitProgressionCelebration({
              kind: 'profile_xp',
              amount: result.pendingXpBreakdown.totalXp,
              source: 'inventory_token',
            });
          }
        } else if (result.streakShield) {
          emitProgressionCelebration({ kind: 'streak', amount: 0, label: 'Shield Activated', subtitle: '24h streak protection' });
        } else if (result.scoutFlightLaunch) {
          emitProgressionCelebration({ kind: 'inventory', amount: 0, label: 'Scout Flight Ready', icon: '🎫' });
        }

        setActivationItem(null);

        const target = result.navigationTarget || def.navigationTarget;
        if (target && target !== '/perk-machine') {
          navigate(target);
        } else if (result.autoSpin || def.itemType === 'extra_free_spin_egg') {
          window.setTimeout(() => void handleSpin('free'), 700);
        } else {
          showConfirm(result.message || `${def.label} activated`);
        }
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          'Token could not be activated. Nothing was consumed.';
        showConfirm(msg, 'error');
      } finally {
        setActivatingKey(null);
      }
    },
    [activatingKey, refreshProfile, showConfirm, navigate, handleSpin]
  );

  const handleHatchStatusUpdate = useCallback((nextStatus) => {
    if (nextStatus) setStatus(nextStatus);
  }, []);

  const applyUseResult = useCallback(
    (result) => {
      if (result?.status) {
        setStatus(result.status);
        if (typeof result.status.powerMultiplierBonus === 'number') {
          setPermanentPowerBonus(result.status.powerMultiplierBonus);
        }
      }
      if (typeof result?.savvyBalance === 'number' && typeof patchUser === 'function') {
        applyServerSavvyBalance(patchUser, result.savvyBalance, { source: 'perk_machine_use' });
      }
      window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
    },
    [patchUser]
  );

  const handleActivateEvent = useCallback(
    async (tokenId) => {
      if (activating) return;
      setActivating(true);
      try {
        const result = await activatePerkEventToken(tokenId);
        applyUseResult(result);
        showConfirm(result?.message || 'Event activated');
      } catch (e) {
        showConfirm(e?.response?.data?.message || e?.message || 'Activation failed.', 'error');
      } finally {
        setActivating(false);
      }
    },
    [activating, applyUseResult, showConfirm]
  );

  const handleMaxSupplyDrop = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    try {
      const result = await activateMaxSupplyDropToken();
      applyUseResult(result);
      showConfirm(result?.message || 'Max Supply Drop deployed');
    } catch (e) {
      showConfirm(e?.response?.data?.message || e?.message || 'Activation failed.', 'error');
    } finally {
      setActivating(false);
    }
  }, [activating, applyUseResult, showConfirm]);

  const handleTierSkip = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    try {
      const result = await redeemBattlePassTierSkip();
      applyUseResult(result);
      showConfirm(result?.message || 'Battle Pass tier skipped');
    } catch (e) {
      showConfirm(e?.response?.data?.message || e?.message || 'Tier skip failed.', 'error');
    } finally {
      setActivating(false);
    }
  }, [activating, applyUseResult, showConfirm]);

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
    <div className={`perk-page ${savvySaleDisplay?.active ? 'perk-page--savvy-sale' : ''} ${multiplierPulse ? 'perk-page--multiplier-pulse' : ''}`}>
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
          <SavvySalePerkBadge sale={savvySaleDisplay} msRemaining={saleMs} scoutLine />
        </div>
        <div className="perk-header__actions">
          <button
            type="button"
            className="perk-reward-index-btn"
            onClick={() => setShowRewardIndex(true)}
            aria-label="Open Reward Index"
          >
            ℹ️ Reward Index
          </button>
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
                    isMultiplier={displayRewards[idx]?.type === 'multiplier_2x'}
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

          <PerkMachineTournamentProgress
            progress={status?.tournamentTicketProgress}
            pulse={ticketProgressPulse}
          />

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

          {reelPhase === 'complete' && (resolvedRewards.length > 0 || displayRewards.length > 0) ? (
            <div className="perk-result-summary perk-result-summary--above-hud">
              <div className="perk-result-summary__title">{resultMessage}</div>

              {lastMultiplier?.factor > 1 && lastMultiplier.breakdown?.expression ? (
                <div
                  className={`perk-mult-breakdown ${lastMultiplier.isJackpot ? 'perk-mult-breakdown--jackpot' : ''}`}
                  role="status"
                >
                  <span className="perk-mult-breakdown__badge">
                    {lastMultiplier.isJackpot ? '8× Jackpot' : `${lastMultiplier.factor}× Multiplier`}
                  </span>
                  <p className="perk-mult-breakdown__expr">{lastMultiplier.breakdown.expression}</p>
                  <p className="perk-mult-breakdown__hint">Doubles other rewards in this spin.</p>
                </div>
              ) : null}

              <div className="perk-result-summary__grid">
                {(resolvedRewards.length ? resolvedRewards : displayRewards).map((reward) => (
                  <div
                    key={`${reward.id}-${reward.label}-${reward.multiplierRole ? 'm' : 'r'}`}
                    className={`perk-reward-card ${rarityClass(reward.rarity, reward.type)} ${
                      reward.multiplierRole ? 'perk-reward-card--multiplier' : ''
                    }`}
                    title={reward.type === 'multiplier_2x' ? 'Doubles other rewards in this spin.' : undefined}
                  >
                    <span className="perk-reward-card__icon">{reward.icon}</span>
                    <span className="perk-reward-card__label">
                      {reward.type === 'multiplier_2x' ? '2×' : reward.label}
                    </span>
                    {reward.multiplierRole ? (
                      <span className="perk-reward-card__mult-hint">Doubles other rewards</span>
                    ) : null}
                    {reward.baseLabel && reward.label !== reward.baseLabel ? (
                      <span className="perk-reward-card__base">{reward.baseLabel}</span>
                    ) : null}
                    {reward.savvyBoosted ? <span className="perk-reward-card__boost">1.5× boost</span> : null}
                    {reward.spinMultiplierApplied && reward.spinMultiplierApplied > 1 ? (
                      <span className="perk-reward-card__spin-mult">{reward.spinMultiplierApplied}× spin</span>
                    ) : null}
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
              {INVENTORY_TOKEN_DEFS.map((def) => {
                const count = def.countFrom(status);
                const isActive = isBoostActiveForDef(status, def);
                const isBusy = activatingKey === def.itemType;
                return (
                  <li key={def.itemType} className="perk-inv-item">
                    <span className="perk-inv-item__label">
                      {def.icon} {def.label}
                    </span>
                    <span className="perk-inv-item__right">
                      <strong>{count}</strong>
                      <button
                        type="button"
                        className="perk-inv-item__use"
                        disabled={count < 1 || (tokenActivating && !isBusy)}
                        onClick={() => setActivationItem({ ...def, count, isActive })}
                      >
                        {isBusy ? 'Activating…' : isActive && def.boostKey ? 'Extend +30m' : 'Use'}
                      </button>
                    </span>
                  </li>
                );
              })}
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
                  const rewards = spin.rewards || [];
                  const cardReward = rewards.find((r) => r.type === 'calling_card');
                  const rewardLabels =
                    rewards
                      .map((r) => (r.type === 'calling_card' ? '🏆 Calling Card Drop' : r.label))
                      .join(', ') || '—';
                  return (
                    <li key={spin.spinId} className="perk-history-item">
                      <span className="perk-history-item__mode">{prettyMode(spin.mode)}</span>
                      <span className="perk-history-item__line">
                        Cost: <span className="perk-history-item__cost">{cost > 0 ? `-${cost}` : '0'}</span> ·
                        {' '}Rewards: <span className="perk-history-item__rewards">{rewardLabels}</span>
                      </span>
                      {cardReward?.callingCardName ? (
                        <span className="perk-history-item__unlocked">
                          Unlocked: {cardReward.callingCardName}
                          {cardReward.callingCardDuplicate ? ' (duplicate → +150 Savvy)' : ''}
                        </span>
                      ) : null}
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

      <HatchRewardsInventory
        status={status}
        onActivateEvent={handleActivateEvent}
        onMaxSupplyDrop={handleMaxSupplyDrop}
        onTierSkip={handleTierSkip}
        busy={activating}
      />

      {showAdmin ? (
        <PerkMachineAdminPanel onStatusRefresh={loadStatus} />
      ) : null}

      <TokenActivationModal
        open={Boolean(activationItem)}
        def={activationItem}
        count={activationItem?.count || 0}
        activating={tokenActivating}
        isActive={Boolean(activationItem?.isActive)}
        onCancel={() => !tokenActivating && setActivationItem(null)}
        onConfirm={() => activationItem && void handleActivate(activationItem)}
      />

      {ticketUnlock ? (
        <div className="perk-ticket-unlock" role="alert" aria-live="assertive" key={ticketUnlock.id}>
          <div className="perk-ticket-unlock__card">
            <span className="perk-ticket-unlock__icon" aria-hidden>🎫</span>
            <h3 className="perk-ticket-unlock__title">Tournament Ticket Earned!</h3>
            <p className="perk-ticket-unlock__message">Ready to compete for Savvy Points.</p>
            <p className="perk-ticket-unlock__count">
              {ticketUnlock.ticketsOwned} ticket{ticketUnlock.ticketsOwned === 1 ? '' : 's'} in inventory
            </p>
          </div>
        </div>
      ) : null}

      {directTicketAward ? (
        <div className="perk-ticket-unlock perk-ticket-unlock--direct" role="alert" aria-live="assertive" key={directTicketAward.id}>
          <div className="perk-ticket-unlock__card">
            <span className="perk-ticket-unlock__icon" aria-hidden>🎟</span>
            <h3 className="perk-ticket-unlock__title">Scout Flight Ticket Awarded</h3>
            <p className="perk-ticket-unlock__message">
              Use this ticket to enter official Scout Flight Tournament Mode and compete for Savvy Points.
            </p>
            <p className="perk-ticket-unlock__count">
              +{directTicketAward.ticketsGranted} · {directTicketAward.ticketsOwned} in inventory
            </p>
          </div>
        </div>
      ) : null}

      <PerkRewardReveal reveal={heroReveal} onClose={() => setHeroReveal(null)} />

      <PerkRewardIndexModal open={showRewardIndex} onClose={() => setShowRewardIndex(false)} />

      <footer className="perk-footer">
        <Final10Slogan variant="footer" />
      </footer>
    </div>
  );
}
