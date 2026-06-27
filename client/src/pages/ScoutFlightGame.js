import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createGame,
  updateGame,
  flap,
  restartGame,
  resetGame,
  PHASE,
} from '../lib/scoutFlightEngine';
import '../styles/ScoutFlight.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

function drawBackground(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a0618');
  g.addColorStop(0.45, '#12082a');
  g.addColorStop(1, '#1a0f35');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137 + t * 0.02) % w);
    const sy = ((i * 89) % (h * 0.75));
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

function drawObstacle(ctx, o, h, groundH) {
  const grad = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
  grad.addColorStop(0, '#2d1b4e');
  grad.addColorStop(0.5, '#4c1d95');
  grad.addColorStop(1, '#2d1b4e');
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, 0, o.w, o.topH);
  ctx.fillRect(o.x, o.bottomY, o.w, h - groundH - o.bottomY);

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, 0, o.w - 2, o.topH);
  ctx.strokeRect(o.x + 1, o.bottomY, o.w - 2, h - groundH - o.bottomY);

  ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.beginPath();
  const tx = o.x + o.w / 2;
  ctx.moveTo(tx, o.topH - 18);
  ctx.lineTo(tx - 10, o.topH - 4);
  ctx.lineTo(tx + 10, o.topH - 4);
  ctx.closePath();
  ctx.fill();
}

function drawCoin(ctx, c) {
  if (c.collected) return;
  const { color, glow } = c.type;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 2, c.x, c.y, c.r);
  g.addColorStop(0, glow);
  g.addColorStop(0.6, color);
  g.addColorStop(1, '#422006');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = 'bold 9px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${c.value}`, c.x, c.y);
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

export default function ScoutFlightGame() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const scoutImgRef = useRef(null);
  const [uiPhase, setUiPhase] = useState(PHASE.IDLE);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(480, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!gameRef.current) {
      gameRef.current = createGame(w, h);
    } else {
      gameRef.current.width = w;
      gameRef.current.height = h;
      gameRef.current.groundH = Math.max(36, Math.round(h * 0.08));
      gameRef.current.scoutX = Math.round(w * 0.22);
      gameRef.current.scout.x = gameRef.current.scoutX;
    }
  }, []);

  const drawFrame = useCallback((ts) => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;

    const ctx = canvas.getContext('2d');
    const w = game.width;
    const h = game.height;

    if (lastTsRef.current) {
      const dt = Math.min(32, ts - lastTsRef.current);
      updateGame(game, dt);
      setScore(game.score);
      setBest(game.best);
      setUiPhase(game.phase);
    }
    lastTsRef.current = ts;

    drawBackground(ctx, w, h, ts);
    for (const o of game.obstacles) drawObstacle(ctx, o, h, game.groundH);
    for (const c of game.coins) drawCoin(ctx, c);

    const s = game.scout;
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate(s.rot || 0);
    const img = scoutImgRef.current;
    if (img?.complete) {
      ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
      ctx.shadowBlur = 16;
      ctx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h);
    } else {
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(0, 0, s.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const p of game.coinPopups) {
      ctx.globalAlpha = Math.min(1, p.life / 400);
      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 14px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${p.value}`, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    drawGround(ctx, w, h, game.groundH);

    if (game.phase === PHASE.PLAYING) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 28px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(game.score), w / 2, 48);
      ctx.font = '600 11px system-ui,sans-serif';
      ctx.fillStyle = 'rgba(196, 181, 253, 0.85)';
      ctx.fillText(`BEST ${game.best}`, w / 2, 66);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = SCOUT_IMG;
    scoutImgRef.current = img;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resize, drawFrame]);

  const handleInput = useCallback((e) => {
    e.preventDefault();
    const game = gameRef.current;
    if (!game) return;
    if (game.phase === PHASE.GAMEOVER) return;
    flap(game);
  }, []);

  const handleRestart = useCallback(() => {
    gameRef.current = restartGame(gameRef.current);
    setUiPhase(PHASE.PLAYING);
    setScore(0);
  }, []);

  const handleBackToIdle = useCallback(() => {
    gameRef.current = resetGame(gameRef.current);
    setUiPhase(PHASE.IDLE);
    setScore(0);
  }, []);

  return (
    <div className="scout-flight-page">
      <header className="scout-flight-page__header">
        <Link to="/events" className="scout-flight-page__back">
          ← Events
        </Link>
        <span className="scout-flight-page__title">Savvy Scout Flight</span>
        <span className="scout-flight-page__beta">Beta · Local score</span>
      </header>

      <div
        ref={wrapRef}
        className="scout-flight-stage"
        role="application"
        aria-label="Savvy Scout Flight mini-game"
        onPointerDown={handleInput}
        onTouchStart={handleInput}
      >
        <canvas ref={canvasRef} className="scout-flight-canvas" />

        {uiPhase === PHASE.IDLE ? (
          <div className="scout-flight-overlay scout-flight-overlay--start">
            <div className="scout-flight-logo">
              <span className="scout-flight-logo__wings">🪽</span>
              <h1>SAVVY SCOUT FLIGHT</h1>
              <span className="scout-flight-logo__wings">🪽</span>
            </div>
            <p className="scout-flight-tagline">Collect Savvy Coins. Dodge the hazards.</p>
            <img src={SCOUT_IMG} alt="" className="scout-flight-scout-preview" />
            <p className="scout-flight-hint">Tap or click to launch</p>
            <p className="scout-flight-note">Score is local only — rewards coming soon.</p>
          </div>
        ) : null}

        {uiPhase === PHASE.GAMEOVER ? (
          <div className="scout-flight-overlay scout-flight-overlay--gameover">
            <h2 className="scout-flight-go-title">Flight Ended</h2>
            <p className="scout-flight-go-score">{score.toLocaleString()}</p>
            <p className="scout-flight-go-label">Run Score</p>
            <p className="scout-flight-go-best">Best: {best.toLocaleString()}</p>
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
    </div>
  );
}
