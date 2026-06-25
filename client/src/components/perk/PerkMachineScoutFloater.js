import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  isPerkScoutAnimationBusy,
  pickScoutCorner,
  resolvePerkScoutMessage,
} from '../../lib/perkScoutDialogue';

const PROTECTED_SELECTORS = ['.perk-reels', '.perk-machine__sign'];
const REOPEN_DELAY_MS = 2000;

export default function PerkMachineScoutFloater({
  panelRef,
  reelPhase,
  displayRewards,
  subscriptionLabel,
  error,
  eggPulseTier,
  hovering = false,
}) {
  const floaterRef = useRef(null);
  const [userMinimized, setUserMinimized] = useState(false);
  const [bubbleReady, setBubbleReady] = useState(true);
  const [corner, setCorner] = useState('br');
  const [message, setMessage] = useState(() =>
    resolvePerkScoutMessage({ reelPhase, displayRewards, subscriptionLabel, error, eggPulseTier, hovering })
  );
  const [messageKey, setMessageKey] = useState(0);
  const pendingMessageRef = useRef(null);
  const reopenTimerRef = useRef(null);

  const animationBusy = isPerkScoutAnimationBusy(reelPhase, eggPulseTier);

  const updateCorner = useCallback(() => {
    const panel = panelRef?.current;
    const floater = floaterRef.current;
    if (!panel || !floater) return;
    const next = pickScoutCorner(floater, panel, PROTECTED_SELECTORS);
    setCorner(next);
  }, [panelRef]);

  useLayoutEffect(() => {
    updateCorner();
  }, [updateCorner, reelPhase, bubbleReady, userMinimized, message]);

  useEffect(() => {
    const onResize = () => updateCorner();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateCorner]);

  useEffect(() => {
    const nextMessage = resolvePerkScoutMessage({
      reelPhase,
      displayRewards,
      subscriptionLabel,
      error,
      eggPulseTier,
      hovering,
    });

    if (animationBusy) {
      setBubbleReady(false);
      pendingMessageRef.current = nextMessage;
      return undefined;
    }

    if (reelPhase === 'complete' && displayRewards.length > 0) {
      pendingMessageRef.current = nextMessage;
      if (reopenTimerRef.current) window.clearTimeout(reopenTimerRef.current);
      reopenTimerRef.current = window.setTimeout(() => {
        const msg = pendingMessageRef.current || nextMessage;
        setMessage(msg);
        setMessageKey((k) => k + 1);
        pendingMessageRef.current = null;
        if (!userMinimized) setBubbleReady(true);
      }, REOPEN_DELAY_MS);
      return () => {
        if (reopenTimerRef.current) window.clearTimeout(reopenTimerRef.current);
      };
    }

    setMessage(nextMessage);
    setMessageKey((k) => k + 1);
    if (!userMinimized) setBubbleReady(true);
    return undefined;
  }, [
    animationBusy,
    reelPhase,
    displayRewards,
    subscriptionLabel,
    error,
    eggPulseTier,
    hovering,
    userMinimized,
  ]);

  const showBubble = !userMinimized && bubbleReady && !animationBusy;

  const toggleMinimized = useCallback(() => {
    setUserMinimized((prev) => {
      const next = !prev;
      if (!next) setBubbleReady(true);
      return next;
    });
  }, []);

  const minimize = useCallback(() => {
    setUserMinimized(true);
    setBubbleReady(false);
  }, []);

  return (
    <div
      ref={floaterRef}
      className={[
        'perk-scout-floater',
        `perk-scout-floater--${corner}`,
        userMinimized ? 'perk-scout-floater--minimized' : '',
        showBubble ? 'perk-scout-floater--open' : '',
        animationBusy ? 'perk-scout-floater--busy' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
    >
      <div
        className={`perk-scout-floater__bubble-wrap ${showBubble ? 'perk-scout-floater__bubble-wrap--visible' : ''}`}
        aria-hidden={!showBubble}
      >
        <div className="perk-scout-floater__bubble" key={messageKey}>
          <div className="perk-scout-floater__bubble-header">
            <span className="perk-scout-floater__name">Savvy Scout</span>
            <button
              type="button"
              className="perk-scout-floater__minimize"
              onClick={minimize}
              aria-label="Minimize Savvy Scout message"
            >
              −
            </button>
          </div>
          <p className="perk-scout-floater__text">{message}</p>
        </div>
      </div>

      <button
        type="button"
        className="perk-scout-floater__avatar"
        onClick={toggleMinimized}
        aria-label={userMinimized ? 'Open Savvy Scout message' : 'Minimize Savvy Scout'}
        aria-expanded={showBubble}
      >
        <img
          src="/assets/perk-machine/savvy-scout-alive.png"
          alt=""
          className="perk-scout-floater__img"
          aria-hidden
        />
        <span className="perk-scout-floater__eyes" aria-hidden>
          <span className="perk-scout-floater__eye perk-scout-floater__eye--l" />
          <span className="perk-scout-floater__eye perk-scout-floater__eye--r" />
        </span>
        {userMinimized ? <span className="perk-scout-floater__ping" aria-hidden /> : null}
      </button>
    </div>
  );
}
