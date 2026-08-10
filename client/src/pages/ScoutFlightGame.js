import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applyServerSavvyBalance } from '../lib/applyServerSavvyBalance';
import {
  getScoutFlightTournamentStatus,
  getScoutFlightChampionship,
  startScoutFlightTournament,
  adminStartScoutFlightTestRun,
  submitScoutFlightTournamentScore,
  getScoutFlightLeaderboard,
  getScoutFlightSeasonLeaderboard,
} from '../lib/api';
import { SAVVY_AUTH_REFRESH_REQUEST } from '../store/savvyStore';
import {
  createGame,
  updateGame,
  flap,
  restartGame,
  resetGame,
  PHASE,
  coinsUntilCombo,
  getDifficultyConfig,
  loadSavedDifficulty,
  saveDifficulty,
  applyDifficultyToScout,
  getScoutCollisionRadius,
  loadDebugHitboxEnabled,
  isDebugHitboxAllowed,
} from '../lib/scoutFlightEngine';
import { emitScoutFlightSound, SCOUT_FLIGHT_SOUNDS } from '../lib/scoutFlightAudio';
import {
  attachNukeState,
  devForceNukeActivation,
  devSeedNukeClock,
  devSetNukeSurvival,
  getNukeRunSummary,
  handleNukeRunEnd,
} from '../lib/scoutFlightNukeEngine';
import { NUKE_STATE } from '../lib/scoutFlightNukeConfig';
import { detectNukeQualityTier } from '../lib/scoutFlightNukeQuality';
import { startScoutFlightHeartbeatLoop } from '../lib/scoutFlightHeartbeat';
import { handleNukeAudioEvent, stopAllNukeAudio } from '../lib/scoutFlightNukeAudio';
import {
  drawCrumblingObstacle,
  drawNukeBlastWall,
  drawNukeDebris,
  drawNukeFlash,
  drawNukeShockwaves,
  drawNukeSky,
  drawNukeVignette,
  drawNukeWarningAtmosphere,
  getNukeShakeOffset,
} from '../lib/scoutFlightNukeRender';
import {
  ScoutFlightNukeActivation,
  ScoutFlightNukeAnomaly,
  ScoutFlightNukeDeathBanner,
  ScoutFlightNukeDevPanel,
  ScoutFlightNukeHud,
  ScoutFlightNukeResults,
} from '../components/scoutFlight/ScoutFlightNukeUI';
import {
  exitScoutFlightGameplayMusic,
  isMenuMusicRoute,
  startScoutFlightGameplayMusicFromGesture,
} from '../lib/appMusicCoordinator';
import {
  duckScoutFlightMusicForDuration,
  SCOUT_FLIGHT_MUSIC_DUCK,
  scoutFlightMusicEngine,
} from '../lib/scoutFlightMusicEngine';
import { menuMusicEngine } from '../lib/menuMusicEngine';
import {
  lockBodyScroll,
  unlockBodyScroll,
} from '../lib/scoutFlightFocusMode';
import {
  setScoutFlightGameplayFocus,
} from '../lib/scoutFlightGameplayFocus';
import '../styles/ScoutFlight.css';
import '../styles/ScoutFlightNuke.css';
import {
  ScoutFlightChampionshipScreen,
  ScoutFlightLeaderboardPanel,
  ScoutFlightTournamentResult,
  ScoutFlightLockedModal,
  ScoutFlightConfirmModal,
} from '../components/scoutFlight/ScoutFlightChampionshipUI';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';
const BOTTOM_UI_RESERVE = 88;

function formatFlightTime(ms) {
  const sec = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawBackground(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a0618');
  g.addColorStop(0.45, '#12082a');
  g.addColorStop(1, '#1a0f35');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 40; i++) {
    const sx = (i * 137 + t * 0.02) % w;
    const sy = (i * 89) % (h * 0.75);
    ctx.fillStyle = `rgba(168, 85, 247, ${0.08 + (i % 5) * 0.03})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const cityY = h * 0.55;
  ctx.fillStyle = 'rgba(30, 15, 60, 0.6)';
  for (let i = 0; i < 8; i++) {
    const bw = 40 + (i % 4) * 25;
    const bx = ((i * 110 - t * 0.15) % (w + 100)) - 50;
    const bh = 60 + (i % 5) * 35;
    ctx.fillRect(bx, cityY + (120 - bh), bw, bh);
  }
}

function drawWarningTriangle(ctx, cx, cy, size, pulse) {
  const glow = 0.55 + pulse * 0.35;
  ctx.save();
  ctx.shadowColor = `rgba(239, 68, 68, ${glow})`;
  ctx.shadowBlur = 10 + pulse * 6;
  ctx.fillStyle = `rgba(239, 68, 68, ${0.75 + pulse * 0.2})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx - size * 0.95, cy + size * 0.55);
  ctx.lineTo(cx + size * 0.95, cy + size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a0f35';
  ctx.font = `bold ${Math.max(8, size * 0.85)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.fillText('!', cx, cy + size * 0.05);
  ctx.restore();
}

function drawObstacle(ctx, o, h, groundH, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.004 + o.x * 0.02);
  const blocks = [
    { x: o.x, y: 0, w: o.w, hh: o.topH },
    { x: o.x, y: o.bottomY, w: o.w, hh: h - groundH - o.bottomY },
  ];

  for (const b of blocks) {
    ctx.save();
    ctx.shadowColor = `rgba(168, 85, 247, ${0.35 + pulse * 0.25})`;
    ctx.shadowBlur = 14;

    const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.hh);
    grad.addColorStop(0, '#1a0f35');
    grad.addColorStop(0.35, '#4c1d95');
    grad.addColorStop(0.65, '#6d28d9');
    grad.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.hh);

    ctx.strokeStyle = `rgba(196, 181, 253, ${0.45 + pulse * 0.35})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.hh - 2);

    ctx.strokeStyle = `rgba(124, 58, 237, ${0.25 + pulse * 0.2})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, Math.max(0, b.hh - 10));
    ctx.restore();
  }

  drawWarningTriangle(ctx, o.x + o.w / 2, o.topH - 14, 11, pulse);
  const bottomTop = o.bottomY + 14;
  drawWarningTriangle(ctx, o.x + o.w / 2, bottomTop + 11, 11, pulse);
}

function drawCoin(ctx, c, t) {
  if (c.collected) return;
  const { color, glow } = c.type;
  const bob = Math.sin(t * 0.006 + c.x * 0.05) * 2;
  const cy = c.y + bob;

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 16;
  const g = ctx.createRadialGradient(c.x - 3, cy - 3, 2, c.x, cy, c.r);
  g.addColorStop(0, '#fffbeb');
  g.addColorStop(0.35, glow);
  g.addColorStop(0.75, color);
  g.addColorStop(1, '#422006');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, cy, c.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(15, 7, 32, 0.5)';
  ctx.font = 'bold 9px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${c.value}`, c.x, cy);
  ctx.restore();
}

function drawCoinPopup(ctx, p) {
  const alpha = Math.min(1, p.life / 500);
  const isGoldTier = p.value >= 10;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.scale(p.scale, p.scale);
  ctx.shadowColor = isGoldTier ? '#fcd34d' : '#fde68a';
  ctx.shadowBlur = isGoldTier ? 22 : 14;
  ctx.font = `bold ${p.value >= 25 ? 18 : p.value >= 10 ? 16 : 14}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(-20, -10, 20, 10);
  grad.addColorStop(0, '#fff7cc');
  grad.addColorStop(0.5, '#fcd34d');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fillText(`+${p.value}`, 0, 0);
  ctx.restore();
}

function drawComboPopup(ctx, p) {
  const alpha = Math.min(1, p.life / 600);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 18;
  ctx.font = 'bold 13px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText(p.label, p.x, p.y);
  ctx.font = 'bold 11px system-ui,sans-serif';
  ctx.fillStyle = '#fcd34d';
  ctx.fillText(`+${p.bonus} bonus`, p.x, p.y + 16);
  ctx.restore();
}

function drawScoutHitboxDebug(ctx, game) {
  const s = game.scout;
  const r = getScoutCollisionRadius(game);
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(s.x, s.y, s.w, s.h);

  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(34, 197, 94, 0.75)';
  ctx.font = '9px system-ui,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${s.w}×${s.h}`, s.x + 2, s.y - 4);
  ctx.restore();
}

function drawGround(ctx, w, h, groundH) {
  const g = ctx.createLinearGradient(0, h - groundH, 0, h);
  g.addColorStop(0, '#3b0764');
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - groundH, w, groundH);
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, h - groundH);
  ctx.lineTo(w, h - groundH);
  ctx.stroke();
}

function handleGameEvents(events) {
  for (const ev of events) {
    if (ev.type === 'flap') emitScoutFlightSound(SCOUT_FLIGHT_SOUNDS.FLAP);
    if (ev.type === 'coin') emitScoutFlightSound(SCOUT_FLIGHT_SOUNDS.COIN, { value: ev.value });
    if (ev.type === 'combo') emitScoutFlightSound(SCOUT_FLIGHT_SOUNDS.COMBO, { bonus: ev.bonus });
    if (ev.type === 'crash') emitScoutFlightSound(SCOUT_FLIGHT_SOUNDS.CRASH, { score: ev.score });
    if (ev.type === 'new_best') emitScoutFlightSound(SCOUT_FLIGHT_SOUNDS.NEW_BEST, { score: ev.score });
    if (ev.type.startsWith('nuke_')) handleNukeAudioEvent(ev);
  }
}

/**
 * Nuke Lab visibility. Never available to ordinary production users: it requires
 * a dev build, or an admin/founder account opting in via ?nukeLab=1.
 */
function nukeDevToolsAllowed(user) {
  if (process.env.NODE_ENV !== 'production') return true;
  const isAdmin = Boolean(user?.isAdmin || user?.isFounder || user?.role === 'admin');
  if (!isAdmin) return false;
  try {
    return new URLSearchParams(window.location.search).get('nukeLab') === '1';
  } catch {
    return false;
  }
}

/** Snapshot signature so the Nuke HUD re-renders about once per second, not per frame. */
function nukeViewSignature(nuke) {
  if (!nuke) return '';
  return [
    nuke.state,
    nuke.multiplier,
    nuke.visualPhase,
    nuke.warningStage?.id || '',
    Math.floor(nuke.activeMs / 1000),
    Math.floor(nuke.nukeSurvivalMs / 1000),
  ].join('|');
}

function toNukeView(nuke) {
  return {
    state: nuke.state,
    practice: nuke.practice,
    multiplier: nuke.multiplier,
    visualPhase: nuke.visualPhase,
    warningStage: nuke.warningStage,
    activeMs: nuke.activeMs,
    nukeSurvivalMs: nuke.nukeSurvivalMs,
  };
}

export default function ScoutFlightGame() {
  const { user, patchUser, refreshProfile } = useAuth();
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const scoutImgRef = useRef(null);
  const [uiPhase, setUiPhase] = useState(PHASE.IDLE);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [difficultyId, setDifficultyId] = useState(() => loadSavedDifficulty());
  const [debugHitbox] = useState(() => loadDebugHitboxEnabled());
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [coinsGrabbed, setCoinsGrabbed] = useState(0);
  const [menuMode, setMenuMode] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [championship, setChampionship] = useState(null);
  const [activeRunId, setActiveRunId] = useState(null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [startingTournament, setStartingTournament] = useState(false);
  const [tournamentResult, setTournamentResult] = useState(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [tournamentError, setTournamentError] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('monthly');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const submitLock = useRef(false);
  const musicStartedRef = useRef(false);
  const debugAllowed = isDebugHitboxAllowed();

  const [qualityTier] = useState(() => detectNukeQualityTier());
  const [nukeView, setNukeView] = useState(null);
  const [nukeSummary, setNukeSummary] = useState(null);
  const nukeViewSigRef = useRef('');
  const nukeSummaryRef = useRef(false);
  const heartbeatSeqRef = useRef(0);
  const isTestRunRef = useRef(false);
  const nukeDevAllowed = nukeDevToolsAllowed(user);

  const isPracticeSession = menuMode === 'practice';
  const isTournamentSession = menuMode === 'tournament';
  const isPracticeMode = isPracticeSession || difficultyId === 'PRACTICE';
  const gameplayActive = Boolean(menuMode);

  useEffect(() => {
    heartbeatSeqRef.current = 0;
  }, [activeRunId]);

  useEffect(() => {
    if (!isTournamentSession || !activeRunId || paused || uiPhase !== PHASE.PLAYING) {
      return undefined;
    }

    const stop = startScoutFlightHeartbeatLoop({
      getGame: () => gameRef.current,
      runId: activeRunId,
      sequenceRef: heartbeatSeqRef,
    });

    return () => stop();
  }, [isTournamentSession, activeRunId, paused, uiPhase]);

  const loadChampionship = useCallback(async () => {
    try {
      const data = await getScoutFlightChampionship();
      setChampionship(data);
      if (data?.activeRun?.runId) {
        setActiveRunId(data.activeRun.runId);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadTournamentStatus = useCallback(async () => {
    try {
      const data = await getScoutFlightTournamentStatus();
      setTournamentStatus(data);
      if (data?.activeRun?.runId) {
        setActiveRunId(data.activeRun.runId);
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadLeaderboard = useCallback(
    async (period = leaderboardPeriod, champ = championship) => {
      setLeaderboardLoading(true);
      try {
        let data;
        if (period === 'previous') {
          const prevId = champ?.previousSeason?.seasonId;
          if (!prevId) {
            setLeaderboard({ entries: [], period: 'previous' });
            return;
          }
          data = await getScoutFlightSeasonLeaderboard(prevId);
        } else if (period === 'monthly') {
          data = await getScoutFlightLeaderboard('monthly');
        } else {
          data = await getScoutFlightLeaderboard(period);
        }
        setLeaderboard(data);
      } catch {
        setLeaderboard(null);
      } finally {
        setLeaderboardLoading(false);
      }
    },
    [leaderboardPeriod, championship]
  );

  useEffect(() => {
    void loadChampionship();
    void loadTournamentStatus();
    void loadLeaderboard('monthly');
  }, [loadChampionship, loadTournamentStatus, loadLeaderboard]);

  const stopGameplayMusic = useCallback(() => {
    musicStartedRef.current = false;
    stopAllNukeAudio();
    void exitScoutFlightGameplayMusic({
      resumeMenu: isMenuMusicRoute(window.location.pathname),
      pathname: window.location.pathname,
    });
  }, []);

  useEffect(() => {
    if (!menuMode) {
      setScoutFlightGameplayFocus(false);
      unlockBodyScroll();
      return undefined;
    }
    lockBodyScroll();
    setScoutFlightGameplayFocus(true);
    setPaused(false);
    menuMusicEngine.pausedForRoute = true;
    void menuMusicEngine.pause({ fadeMs: 600 });
    void scoutFlightMusicEngine.preload(menuMode);
    return () => {
      setScoutFlightGameplayFocus(false);
      unlockBodyScroll();
    };
  }, [menuMode]);

  useEffect(
    () => () => {
      setScoutFlightGameplayFocus(false);
      unlockBodyScroll();
      stopGameplayMusic();
    },
    [stopGameplayMusic]
  );

  useEffect(() => {
    if (!menuMode) return undefined;
    const onVisibility = () => {
      if (document.hidden) {
        // Survival time is active gameplay time: backgrounding the app must never
        // accrue progress toward Nuke Flight.
        if (gameRef.current?.phase === PHASE.PLAYING) setPaused(true);
        void scoutFlightMusicEngine.pauseForBackground({ fadeMs: 400 });
      } else {
        void scoutFlightMusicEngine.resumeFromPause({ fadeMs: 600 });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [menuMode]);

  useEffect(() => {
    if (tournamentResult) {
      duckScoutFlightMusicForDuration(SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_COMPLETE, 5200);
    }
  }, [tournamentResult]);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const page = pageRef.current;
    if (!wrap || !canvas || !page) return;

    if (gameplayActive) {
      wrap.style.flex = '1';
      wrap.style.height = 'auto';
      wrap.style.minHeight = '0';
    } else {
      wrap.style.flex = '';
      const top = page.getBoundingClientRect().top;
      const availH = Math.max(320, Math.floor(window.innerHeight - top - BOTTOM_UI_RESERVE));
      wrap.style.height = `${availH}px`;
      wrap.style.minHeight = '';
    }

    const rect = wrap.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!gameRef.current) {
      gameRef.current = createGame(w, h, difficultyId, {
        practice: menuMode !== 'tournament',
        qualityTier,
      });
    } else {
      gameRef.current.width = w;
      gameRef.current.height = h;
      gameRef.current.groundH = Math.max(36, Math.round(h * 0.08));
      gameRef.current.scoutX = Math.round(w * 0.22);
      gameRef.current.scout.x = gameRef.current.scoutX;
      if (gameRef.current.phase === PHASE.IDLE) {
        applyDifficultyToScout(gameRef.current, gameRef.current.difficultyId);
      }
    }
  }, [difficultyId, gameplayActive, menuMode, qualityTier]);

  // Nuke eligibility labelling follows the selected mode. Re-seeded while idle so
  // a mode switch can never carry practice/tournament state into the next run.
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.nukeOptions = {
      practice: menuMode !== 'tournament',
      qualityTier,
      testOffsetMs: 0,
    };
    if (game.phase === PHASE.IDLE) {
      attachNukeState(game, game.nukeOptions);
      nukeViewSigRef.current = '';
      nukeSummaryRef.current = false;
      setNukeView(null);
      setNukeSummary(null);
    }
  }, [menuMode, qualityTier]);

  useEffect(() => {
    if (!gameplayActive) return undefined;
    const t = window.setTimeout(() => resize(), 40);
    return () => window.clearTimeout(t);
  }, [gameplayActive, resize]);

  useEffect(() => {
    if (!gameplayActive) return undefined;
    const onViewportChange = () => resize();
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, [gameplayActive, resize]);

  const startGameplayMusic = useCallback((mode) => {
    if (musicStartedRef.current || !mode) return;
    musicStartedRef.current = true;
    void startScoutFlightGameplayMusicFromGesture(mode).then((ok) => {
      if (!ok) musicStartedRef.current = false;
      if (mode === 'tournament' && ok) {
        duckScoutFlightMusicForDuration(SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_START, 2400);
      }
    });
  }, []);

  const drawFrame = useCallback((ts) => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;

    const ctx = canvas.getContext('2d');
    const w = game.width;
    const h = game.height;

    if (lastTsRef.current && !paused) {
      const dt = Math.min(32, ts - lastTsRef.current);
      updateGame(game, dt);
      if (game.events.length) handleGameEvents(game.events);
      setScore(game.score);
      setBest(game.best);
      setUiPhase(game.phase);
      setIsNewBest(game.isNewBest);
      setElapsedMs(Math.round(game.elapsed || 0));
      setCoinsGrabbed(Number(game.coinsGrabbed) || 0);

      const sig = nukeViewSignature(game.nuke);
      if (sig !== nukeViewSigRef.current) {
        nukeViewSigRef.current = sig;
        setNukeView(game.nuke ? toNukeView(game.nuke) : null);
      }
      // Captured once at death, not every frame, so the results screen is stable.
      if (game.nuke?.hasActivated && game.phase === PHASE.GAMEOVER && !nukeSummaryRef.current) {
        nukeSummaryRef.current = true;
        setNukeSummary(getNukeRunSummary(game));
      }
    }
    lastTsRef.current = ts;

    const nuke = game.nuke;
    const shake = getNukeShakeOffset(game, ts);

    if (shake.x || shake.y) {
      // Shaking the world leaves a thin margin at the canvas edge; fill it first
      // so the shake can never smear the previous frame into view.
      ctx.fillStyle = '#0a0618';
      ctx.fillRect(0, 0, w, h);
    }

    // Camera shake is a render-only translation; collision math never sees it.
    ctx.save();
    if (shake.x || shake.y) ctx.translate(shake.x, shake.y);

    drawBackground(ctx, w, h, ts);
    drawNukeWarningAtmosphere(ctx, w, h, ts, nuke);
    drawNukeSky(ctx, w, h, ts, nuke);
    drawNukeBlastWall(ctx, game, ts);
    drawNukeShockwaves(ctx, nuke);
    drawNukeDebris(ctx, game);

    // Gameplay layer is always drawn last and at full opacity.
    for (const o of game.obstacles) {
      if (o.nukeDestroyed) drawCrumblingObstacle(ctx, o, h, game.groundH);
      else drawObstacle(ctx, o, h, game.groundH, ts);
    }
    for (const c of game.coins) drawCoin(ctx, c, ts);

    const s = game.scout;
    const spriteW = s.spriteW ?? s.w;
    const spriteH = s.spriteH ?? s.h;
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate(s.rot || 0);
    const img = scoutImgRef.current;
    if (img?.complete) {
      ctx.shadowColor = 'rgba(168, 85, 247, 0.65)';
      ctx.shadowBlur = 18;
      ctx.drawImage(img, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
    } else {
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(0, 0, spriteW / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (debugAllowed && debugHitbox) {
      drawScoutHitboxDebug(ctx, game);
    }

    for (const p of game.coinPopups) drawCoinPopup(ctx, p);
    for (const p of game.comboPopups) drawComboPopup(ctx, p);

    drawGround(ctx, w, h, game.groundH);

    ctx.restore();

    // Screen-space layers: never shaken, alpha-capped so nothing is hidden.
    drawNukeVignette(ctx, w, h, nuke);
    drawNukeFlash(ctx, w, h, nuke);

    if (game.phase === PHASE.PLAYING) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 28px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(game.score), w / 2, 42);
      ctx.font = '600 11px system-ui,sans-serif';
      ctx.fillStyle = 'rgba(196, 181, 253, 0.85)';
      ctx.fillText(`BEST ${game.best}`, w / 2, 58);

      if (game.comboStreak > 0) {
        const until = coinsUntilCombo(game);
        ctx.font = '600 10px system-ui,sans-serif';
        ctx.fillStyle = '#fcd34d';
        ctx.fillText(`COMBO ${game.comboStreak}/3 · ${until} to bonus`, w / 2, 74);
      }
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [debugAllowed, debugHitbox, paused]);

  useEffect(() => {
    const img = new Image();
    img.src = SCOUT_IMG;
    scoutImgRef.current = img;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    const id = window.setTimeout(resize, 120);
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(id);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resize, drawFrame]);

  const resetNukeUi = useCallback(() => {
    stopAllNukeAudio();
    nukeViewSigRef.current = '';
    nukeSummaryRef.current = false;
    heartbeatSeqRef.current = 0;
    isTestRunRef.current = false;
    setNukeView(null);
    setNukeSummary(null);
  }, []);

  const handleNukeDevSeed = useCallback((seconds) => {
    if (!nukeDevAllowed) return;
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === PHASE.IDLE) flap(game);
    devSeedNukeClock(game, seconds);
  }, [nukeDevAllowed]);

  const handleNukeDevActivate = useCallback(() => {
    if (!nukeDevAllowed) return;
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === PHASE.IDLE) flap(game);
    devForceNukeActivation(game);
  }, [nukeDevAllowed]);

  const handleNukeDevSurvival = useCallback((seconds) => {
    if (!nukeDevAllowed) return;
    devSetNukeSurvival(gameRef.current, seconds);
  }, [nukeDevAllowed]);

  const handleNukeDevDeath = useCallback(() => {
    if (!nukeDevAllowed) return;
    const game = gameRef.current;
    if (!game || game.nuke?.state !== NUKE_STATE.NUKE_ACTIVE) return;
    game.phase = PHASE.GAMEOVER;
    handleNukeRunEnd(game);
  }, [nukeDevAllowed]);

  const handleDifficultySelect = useCallback((id) => {
    const saved = saveDifficulty(id);
    setDifficultyId(saved);
    if (gameRef.current) {
      applyDifficultyToScout(gameRef.current, saved);
    }
  }, []);

  const handleStartTestRun = useCallback(async () => {
    if (!nukeDevAllowed) return;
    try {
      const result = await adminStartScoutFlightTestRun();
      isTestRunRef.current = true;
      setActiveRunId(result.runId);
      setMenuMode('tournament');
      setTournamentResult(null);
      submitLock.current = false;
      handleDifficultySelect('TOURNAMENT');
    } catch (e) {
      setTournamentError(e?.response?.data?.message || e?.message || 'Could not start test run.');
    }
  }, [nukeDevAllowed, handleDifficultySelect]);

  const handlePracticeStart = useCallback(() => {
    setMenuMode('practice');
    setTournamentResult(null);
    setTournamentError('');
    handleDifficultySelect('PRACTICE');
  }, [handleDifficultySelect]);

  const handleTournamentRequest = useCallback(() => {
    const tickets = Number(tournamentStatus?.ticketsOwned) || 0;
    const resumedRunId = tournamentStatus?.activeRun?.runId || activeRunId;
    const hasActive = Boolean(resumedRunId);
    if (hasActive) {
      setActiveRunId(resumedRunId);
      setMenuMode('tournament');
      setTournamentResult(null);
      submitLock.current = false;
      handleDifficultySelect('TOURNAMENT');
      return;
    }
    if (tickets < 1) {
      setShowLockedModal(true);
      return;
    }
    setShowConfirmModal(true);
  }, [tournamentStatus, activeRunId, handleDifficultySelect]);

  const handleConfirmTournament = useCallback(async () => {
    setStartingTournament(true);
    setTournamentError('');
    try {
      const result = await startScoutFlightTournament();
      setActiveRunId(result.runId);
      setTournamentStatus(result.status || tournamentStatus);
      setMenuMode('tournament');
      setTournamentResult(null);
      submitLock.current = false;
      handleDifficultySelect('TOURNAMENT');
      setShowConfirmModal(false);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Could not start tournament.';
      setTournamentError(msg);
      if (e?.response?.data?.code === 'NO_TICKETS') {
        setShowConfirmModal(false);
        setShowLockedModal(true);
      }
    } finally {
      setStartingTournament(false);
    }
  }, [tournamentStatus, handleDifficultySelect]);

  const handleInput = useCallback((e) => {
    e.preventDefault();
    if (paused) return;
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === PHASE.GAMEOVER) return;
    if (game.phase === PHASE.IDLE && menuMode) {
      startGameplayMusic(menuMode);
    }
    flap(game);
  }, [menuMode, paused, startGameplayMusic]);

  const handleRestart = useCallback(() => {
    if (isTournamentSession) {
      stopGameplayMusic();
      setMenuMode(null);
      setTournamentResult(null);
      setActiveRunId(null);
      submitLock.current = false;
      gameRef.current = resetGame(gameRef.current);
      resetNukeUi();
      setUiPhase(PHASE.IDLE);
      setScore(0);
      setIsNewBest(false);
      setElapsedMs(0);
      setCoinsGrabbed(0);
      void loadChampionship();
      void loadTournamentStatus();
      void loadLeaderboard(leaderboardPeriod);
      return;
    }
    gameRef.current = restartGame(gameRef.current);
    resetNukeUi();
    setUiPhase(PHASE.PLAYING);
    setScore(0);
    setIsNewBest(false);
    setElapsedMs(0);
    setCoinsGrabbed(0);
  }, [isTournamentSession, stopGameplayMusic, loadChampionship, loadTournamentStatus, loadLeaderboard, leaderboardPeriod, resetNukeUi]);

  const handleBackToIdle = useCallback(() => {
    setPaused(false);
    stopGameplayMusic();
    setMenuMode(null);
    setTournamentResult(null);
    setActiveRunId(null);
    submitLock.current = false;
    gameRef.current = resetGame(gameRef.current);
    resetNukeUi();
    setUiPhase(PHASE.IDLE);
    setScore(0);
    setIsNewBest(false);
    setElapsedMs(0);
    setCoinsGrabbed(0);
    void loadChampionship();
    void loadTournamentStatus();
    void loadLeaderboard(leaderboardPeriod);
  }, [stopGameplayMusic, loadChampionship, loadTournamentStatus, loadLeaderboard, leaderboardPeriod, resetNukeUi]);

  useEffect(() => {
    if (uiPhase !== PHASE.GAMEOVER || !isTournamentSession || !activeRunId || submitLock.current) {
      return;
    }
    submitLock.current = true;
    setSubmittingScore(true);
    const game = gameRef.current;
    const elapsedMs = Math.round(Number(game?.elapsed) || 0);
    const nukeReport = getNukeRunSummary(game);
    void (async () => {
      try {
        const result = await submitScoutFlightTournamentScore({
          runId: activeRunId,
          score,
          elapsedMs,
          baseScore: nukeReport ? nukeReport.baseScore : score,
          nuke: nukeReport?.triggered
            ? {
                nukeSurvivalMs: nukeReport.nukeSurvivalMs,
                highestMultiplier: nukeReport.highestMultiplier,
                bonusScore: nukeReport.bonusScore,
                obstaclesEscaped: nukeReport.obstaclesEscaped,
                structuresDestroyed: nukeReport.structuresDestroyed,
              }
            : null,
        });
        setTournamentResult(result);
        setTournamentStatus(result.status || tournamentStatus);
        if (Number(result.savvyEarned) > 0 && typeof patchUser === 'function') {
          const nextBalance = Math.round(Number(result.savvyBalance ?? result.status?.savvyBalance ?? 0));
          if (nextBalance > 0) {
            applyServerSavvyBalance(patchUser, nextBalance, {
              source: 'scout_flight_tournament',
              amountAdded: Math.round(Number(result.savvyEarned) || 0),
            });
          }
        }
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        void loadChampionship();
        void loadLeaderboard(leaderboardPeriod);
      } catch (e) {
        setTournamentError(e?.response?.data?.message || e?.message || 'Score submission failed.');
      } finally {
        setSubmittingScore(false);
        setActiveRunId(null);
      }
    })();
  }, [
    uiPhase,
    isTournamentSession,
    activeRunId,
    score,
    tournamentStatus,
    patchUser,
    refreshProfile,
    loadChampionship,
    loadLeaderboard,
    leaderboardPeriod,
  ]);

  const ticketCount = Number(tournamentStatus?.ticketsOwned) || 0;
  // The Nuke death cinematic owns the screen until it finishes; the ordinary
  // Game Over UI waits for it.
  const nukeCinematicActive = nukeView?.state === NUKE_STATE.NUKE_DEATH;
  const showGameOverUi = uiPhase === PHASE.GAMEOVER && !nukeCinematicActive;

  return (
    <div
      ref={pageRef}
      className={`scout-flight-page${gameplayActive ? ' scout-flight-page--focus' : ''}`}
    >
      {!gameplayActive ? (
        <header className="scout-flight-page__header">
          <Link to="/events" className="scout-flight-page__back">
            ← Events
          </Link>
          <span className="scout-flight-page__title">Savvy Scout Flight</span>
          <div className="scout-flight-page__header-actions">
            <span className="scout-flight-page__beta">
              {tournamentStatus ? `🎟️ ${ticketCount} tickets` : 'Tournament'}
            </span>
          </div>
        </header>
      ) : null}

      {gameplayActive ? (
        <div className="scout-flight-game-hud" aria-label="Flight HUD">
          <div className="scout-flight-game-hud__stats">
            <span className="scout-flight-game-hud__chip scout-flight-game-hud__chip--mode">
              {isTournamentSession ? '🏆 Tournament' : '🎮 Practice'}
            </span>
            <span className="scout-flight-game-hud__chip">
              Score <strong>{score.toLocaleString()}</strong>
            </span>
            <span className="scout-flight-game-hud__chip">
              🪙 <strong>{coinsGrabbed}</strong>
            </span>
            <span className="scout-flight-game-hud__chip">
              🎟️ <strong>{ticketCount}</strong>
            </span>
            <span className="scout-flight-game-hud__chip">
              ⏱ <strong>{formatFlightTime(elapsedMs)}</strong>
            </span>
          </div>
          <div className="scout-flight-game-hud__actions">
            {uiPhase === PHASE.PLAYING ? (
              <button
                type="button"
                className="scout-flight-game-hud__btn"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPaused((p) => !p);
                }}
                aria-label={paused ? 'Resume flight' : 'Pause flight'}
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            ) : null}
            <button
              type="button"
              className="scout-flight-game-hud__btn scout-flight-game-hud__btn--exit"
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleBackToIdle();
              }}
              aria-label="Exit Scout Flight"
            >
              ✕ Exit
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        className={`scout-flight-stage${isPracticeMode ? ' scout-flight-stage--practice' : ''}${
          isTournamentSession ? ' scout-flight-stage--tournament' : ''
        }${gameplayActive ? ' scout-flight-stage--gameplay' : ''}`}
        role="application"
        aria-label="Savvy Scout Flight mini-game"
        onPointerDown={handleInput}
        onTouchStart={handleInput}
      >
        <canvas ref={canvasRef} className="scout-flight-canvas" />

        <ScoutFlightNukeAnomaly nuke={nukeView} />
        <ScoutFlightNukeHud nuke={nukeView} />
        <ScoutFlightNukeActivation nuke={nukeView} />
        <ScoutFlightNukeDeathBanner nuke={nukeView} />

        {nukeDevAllowed && gameplayActive ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <ScoutFlightNukeDevPanel
              nuke={nukeView}
              onSeedClock={handleNukeDevSeed}
              onForceActivate={handleNukeDevActivate}
              onSetSurvival={handleNukeDevSurvival}
              onForceDeath={handleNukeDevDeath}
              onStartTestRun={() => void handleStartTestRun()}
            />
          </div>
        ) : null}

        {paused && uiPhase === PHASE.PLAYING ? (
          <div className="scout-flight-overlay scout-flight-overlay--pause">
            <p className="scout-flight-go-title">Paused</p>
            <div className="scout-flight-go-actions">
              <button
                type="button"
                className="scout-flight-btn scout-flight-btn--primary"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPaused(false);
                }}
              >
                ▶ Resume
              </button>
              <button
                type="button"
                className="scout-flight-btn scout-flight-btn--ghost"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackToIdle();
                }}
              >
                ✕ Exit
              </button>
            </div>
          </div>
        ) : null}

        {uiPhase === PHASE.IDLE && !menuMode ? (
          <ScoutFlightChampionshipScreen
            championship={championship}
            tournamentStatus={tournamentStatus}
            onPractice={() => handlePracticeStart()}
            onTournament={() => handleTournamentRequest()}
          />
        ) : null}

        {uiPhase === PHASE.IDLE && menuMode ? (
          <div className="scout-flight-overlay scout-flight-overlay--start">
            {isPracticeSession ? (
              <p className="scout-flight-practice-intro">
                Practice Mode — most forgiving hitbox. No Savvy awarded.
              </p>
            ) : (
              <p className="scout-flight-practice-intro scout-flight-practice-intro--tournament">
                🏆 Official Tournament Run — score counts toward leaderboard and Savvy rewards.
              </p>
            )}
            <img src={SCOUT_IMG} alt="" className="scout-flight-scout-preview" />
            <p className="scout-flight-hint">Tap Start or anywhere on the flight deck to launch</p>
            <button
              type="button"
              className="scout-flight-btn scout-flight-btn--primary"
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const game = gameRef.current;
                if (!game || !menuMode) return;
                startGameplayMusic(menuMode);
                if (game.phase === PHASE.IDLE) flap(game);
              }}
            >
              Start Flight
            </button>
            <button
              type="button"
              className="scout-flight-btn scout-flight-btn--ghost"
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleBackToIdle();
              }}
            >
              ← Back to Modes
            </button>
          </div>
        ) : null}

        {showGameOverUi && isTournamentSession ? (
          submittingScore ? (
            <div className="scout-flight-overlay scout-flight-overlay--gameover">
              <p className="scout-flight-go-title">Verifying tournament score…</p>
            </div>
          ) : tournamentResult ? (
            <ScoutFlightTournamentResult
              result={tournamentResult}
              score={score}
              header={<ScoutFlightNukeResults summary={nukeSummary} verified={tournamentResult} />}
              onPlayAgain={(e) => {
                e.stopPropagation();
                handleRestart();
              }}
              onReturn={(e) => {
                e.stopPropagation();
                handleBackToIdle();
              }}
            />
          ) : (
            <div className="scout-flight-overlay scout-flight-overlay--gameover">
              <p className="scout-flight-go-title">Flight Ended</p>
              {tournamentError ? <p className="scout-flight-go-error">{tournamentError}</p> : null}
              <button type="button" className="scout-flight-btn scout-flight-btn--ghost" onClick={handleBackToIdle}>
                Return to Scout Flight
              </button>
            </div>
          )
        ) : null}

        {showGameOverUi && !isTournamentSession ? (
          <div className="scout-flight-overlay scout-flight-overlay--gameover">
            <ScoutFlightNukeResults summary={nukeSummary} verified={null} />
            <h2 className="scout-flight-go-title">Flight Ended</h2>
            <p className="scout-flight-go-mode">
              {getDifficultyConfig(difficultyId).emoji}{' '}
              {getDifficultyConfig(difficultyId).label}
            </p>
            {isNewBest ? <p className="scout-flight-go-new-best">New Best!</p> : null}
            <div className="scout-flight-go-stats">
              <div className="scout-flight-go-stat scout-flight-go-stat--run">
                <span className="scout-flight-go-stat__label">Run Score</span>
                <strong className="scout-flight-go-stat__value">{score.toLocaleString()}</strong>
              </div>
              <div className="scout-flight-go-stat scout-flight-go-stat--best">
                <span className="scout-flight-go-stat__label">Best</span>
                <strong className="scout-flight-go-stat__value">{best.toLocaleString()}</strong>
              </div>
            </div>
            <p className="scout-flight-go-scout">&ldquo;Nice flying, Operator.&rdquo;</p>
            <div className="scout-flight-go-actions">
              <button
                type="button"
                className="scout-flight-btn scout-flight-btn--primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestart();
                }}
              >
                Fly Again
              </button>
              <button
                type="button"
                className="scout-flight-btn scout-flight-btn--ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackToIdle();
                }}
              >
                Main Menu
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {uiPhase === PHASE.IDLE && !menuMode ? (
        <ScoutFlightLeaderboardPanel
          leaderboard={leaderboard}
          period={leaderboardPeriod}
          loading={leaderboardLoading}
          previousSeasonName={championship?.previousSeason?.name}
          onPeriodChange={(p) => {
            setLeaderboardPeriod(p);
            void loadLeaderboard(p, championship);
          }}
        />
      ) : null}

      {tournamentError && uiPhase !== PHASE.GAMEOVER ? (
        <p className="scout-flight-page__error" role="alert">
          {tournamentError}
        </p>
      ) : null}

      <ScoutFlightLockedModal open={showLockedModal} onClose={() => setShowLockedModal(false)} />
      <ScoutFlightConfirmModal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => void handleConfirmTournament()}
        starting={startingTournament}
      />
    </div>
  );
}
