import React, { useCallback, useEffect, useRef, startTransition, useState } from 'react';
import { EventIconVisual } from './EventIconVisual';
import { EventActivationParticles } from './EventActivationParticles';
import { playEventAudio } from '../../lib/eventActivationAudio';
import {
  getEventActivationProfile,
  triggerActivationHaptic,
} from '../../lib/eventActivationProfiles';

const FLY_MS = 720;
const ACTIVATED_HOLD_MS = 520;

export function EventActivationReveal({ event, onActivated }) {
  const [phase, setPhase] = useState('idle');
  const [flyStyle, setFlyStyle] = useState(null);
  const cardRef = useRef(null);
  const tapLockRef = useRef(false);
  const timersRef = useRef([]);

  const profile = getEventActivationProfile(event);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    setPhase('idle');
    setFlyStyle(null);
    tapLockRef.current = false;
    return clearTimers;
  }, [event?.activationId, clearTimers]);

  const startFlyAnimation = useCallback(() => {
    const anchor =
      document.getElementById('f10-event-hud-anchor') ||
      document.getElementById('savvy-wallet-root');
    const card = cardRef.current;
    if (anchor && card) {
      const a = anchor.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (c.left + c.width / 2);
      const dy = a.top + a.height / 2 - (c.top + c.height / 2);
      setFlyStyle({
        '--fly-x': `${dx}px`,
        '--fly-y': `${dy}px`,
      });
    }
    startTransition(() => setPhase('fly'));
    const flyTimer = window.setTimeout(() => {
      if (typeof onActivated === 'function') onActivated(event);
    }, FLY_MS);
    timersRef.current.push(flyTimer);
  }, [event, onActivated]);

  const handleTap = useCallback(() => {
    if (phase !== 'idle' || tapLockRef.current || !event) return;
    tapLockRef.current = true;
    setPhase('playing');

    triggerActivationHaptic(profile.vibrationPattern);

    void playEventAudio(profile.audioKey, { fallbackMs: profile.audioFallbackMs }).then(() => {
      startTransition(() => setPhase('activated'));
      const holdTimer = window.setTimeout(() => {
        startFlyAnimation();
      }, ACTIVATED_HOLD_MS);
      timersRef.current.push(holdTimer);
    });
  }, [phase, event, profile, startFlyAnimation]);

  if (!event) return null;

  const isInteractive = phase === 'idle';
  const showParticles = phase === 'playing';
  const showGlowPulse = phase === 'playing' || phase === 'activated';
  const showActivatedCopy = phase === 'activated' || phase === 'fly';

  return (
    <div
      className={[
        'f10-event-reveal',
        profile.rarity === 'premium' ? 'f10-event-reveal--premium' : '',
        profile.rarity === 'limited' ? 'f10-event-reveal--limited' : '',
        profile.rarity === 'rare' ? 'f10-event-reveal--rare' : '',
        `f10-event-reveal--${profile.theme}`,
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={`Activate ${event.title}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="f10-event-reveal__backdrop" aria-hidden />

      <div className="f10-event-reveal__content">
        {phase === 'idle' ? (
          <p
            className={[
              'f10-event-reveal__headline',
              profile.rarity === 'premium' ? 'f10-event-reveal__headline--premium' : '',
              profile.rarity === 'limited' ? 'f10-event-reveal__headline--limited' : '',
              profile.rarity === 'rare' ? 'f10-event-reveal__headline--rare' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ color: profile.color }}
          >
            {profile.headline}
          </p>
        ) : null}

        <div className="f10-event-reveal__icon-stage">
          {showGlowPulse ? (
            <div
              className={[
                'f10-event-reveal__glow',
                `f10-event-reveal__glow--${profile.theme}`,
                'f10-event-reveal__glow--pulse',
                profile.glowIntensity === 'strong' ? 'f10-event-reveal__glow--strong' : '',
                profile.glowIntensity === 'sale' ? 'f10-event-reveal__glow--sale' : '',
                profile.glowIntensity === 'drop' ? 'f10-event-reveal__glow--drop' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--f10-event-glow': profile.glowColor }}
              aria-hidden
            />
          ) : null}

          <button
            type="button"
            className={[
              'f10-event-reveal__card',
              `f10-event-reveal__card--${profile.theme}`,
              `f10-event-reveal__card--${phase}`,
              phase === 'playing' && profile.impactAnimation === 'shake'
                ? 'f10-event-reveal__card--impact-shake'
                : '',
              phase === 'playing' && profile.impactAnimation === 'bounce'
                ? 'f10-event-reveal__card--impact-bounce'
                : '',
              phase === 'playing' && profile.impactAnimation === 'flare'
                ? 'f10-event-reveal__card--impact-flare'
                : '',
              profile.rarity === 'premium' ? 'f10-event-reveal__card--premium' : '',
              profile.rarity === 'limited' ? 'f10-event-reveal__card--limited' : '',
              profile.rarity === 'rare' ? 'f10-event-reveal__card--rare' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            ref={cardRef}
            style={{
              ...(flyStyle || {}),
              '--f10-event-accent': profile.color,
            }}
            onClick={handleTap}
            disabled={!isInteractive}
            aria-disabled={!isInteractive}
          >
            <EventActivationParticles
              active={showParticles}
              particleClass={profile.particleClass}
              effect={profile.particleEffect || 'coin'}
            />
            <EventIconVisual
              theme={profile.theme}
              iconKey={event.iconKey}
              size="large"
              pulsing={phase === 'idle'}
            />
            {phase === 'idle' ? (
              <>
                <h2 className="f10-event-reveal__title">{event.title}</h2>
                <p className="f10-event-reveal__subtitle">{event.subtitle}</p>
                <span className="f10-event-reveal__cta">{profile.idleCta}</span>
              </>
            ) : null}
          </button>
        </div>

        {showActivatedCopy ? (
          <div className={`f10-event-reveal__activated f10-event-reveal__activated--${profile.theme}`}>
            <h3 className="f10-event-reveal__activated-title">{profile.activatedTitle}</h3>
            <p className="f10-event-reveal__activated-body">{profile.activatedMessage}</p>
          </div>
        ) : null}

        {phase === 'playing' ? (
          <p className="f10-event-reveal__listening" aria-live="polite">
            Savvy Scout briefing…
          </p>
        ) : null}
      </div>
    </div>
  );
}
