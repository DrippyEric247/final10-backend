import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { SavvyPointsIcon } from "../components/rewards/SavvyPointsIcon";
import { INTERESTS } from "../lib/onboardingInterests";
import {
  MAX_INTERESTS,
  getSelectedInterests,
  onboardingUserId,
  setSelectedInterests,
  type InterestId,
} from "../lib/onboardingPreferences";
import { onboardingAnalytics } from "../lib/onboardingAnalytics";
import "../styles/OnboardingPreferences.css";

const TRANSITION_STAGES = [
  "Scanning deals...",
  "Checking trust...",
  "Finding your Best Move...",
];
const TRANSITION_TOTAL_MS = 1250;
const TRANSITION_STAGE_MS = 360;

export default function OnboardingPreferences() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = onboardingUserId(user);
  const [selected, setSelected] = useState<InterestId[]>(() =>
    getSelectedInterests(userId)
  );
  const [shake, setShake] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStage, setTransitionStage] = useState(0);

  useEffect(() => {
    onboardingAnalytics.started({
      resuming: selected.length > 0,
      initialCount: selected.length,
    });
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    (id: InterestId) => {
      setSelected((prev) => {
        const has = prev.includes(id);
        if (has) {
          const next = prev.filter((x) => x !== id);
          onboardingAnalytics.interestSelected(id, next.length);
          return next;
        }
        if (prev.length >= MAX_INTERESTS) {
          setShake(true);
          window.setTimeout(() => setShake(false), 420);
          return prev;
        }
        const next = [...prev, id];
        onboardingAnalytics.interestSelected(id, next.length);
        return next;
      });
    },
    []
  );

  const canSubmit = selected.length > 0;
  const remaining = Math.max(0, MAX_INTERESTS - selected.length);

  const submit = useCallback(() => {
    if (!canSubmit || isTransitioning) return;
    setSelectedInterests(selected, userId);
    // Required debug trail for first Best Move onboarding reliability.
    // eslint-disable-next-line no-console
    console.info("[OnboardingBestMove] selected_interests_after_submit", {
      selectedInterests: selected,
    });
    onboardingAnalytics.submitted(selected);
    setIsTransitioning(true);
    setTransitionStage(0);
  }, [canSubmit, isTransitioning, selected, userId]);

  useEffect(() => {
    if (!isTransitioning) return;
    const stageId = window.setInterval(() => {
      setTransitionStage((prev) => (prev + 1) % TRANSITION_STAGES.length);
    }, TRANSITION_STAGE_MS);
    const navId = window.setTimeout(() => {
      navigate("/onboarding/best-move", { replace: true });
    }, TRANSITION_TOTAL_MS);
    return () => {
      window.clearInterval(stageId);
      window.clearTimeout(navId);
    };
  }, [isTransitioning, navigate]);

  const counterCopy = useMemo(() => {
    if (selected.length === 0) return "Pick 1–3 interests to continue.";
    if (selected.length === MAX_INTERESTS) return "Max reached — we'll rank across all three.";
    if (remaining === 1) return "Pick 1 more or tap continue.";
    return `Pick up to ${remaining} more or tap continue.`;
  }, [remaining, selected.length]);

  return (
    <div className="onboard-pref-overlay" role="dialog" aria-labelledby="onboard-pref-title">
      <div className={`onboard-pref-shell ${shake ? "is-shaking" : ""}`}>
        {isTransitioning ? (
          <div className="onboard-pref-transition" aria-live="polite">
            <div className="onboard-pref-transition-spinner" aria-hidden />
            <div className="onboard-pref-eyebrow">Final10 · locking your picks</div>
            <h2 className="onboard-pref-transition-title">Setting up your first win</h2>
            <div className="onboard-pref-transition-stage">
              {TRANSITION_STAGES[transitionStage]}
            </div>
          </div>
        ) : null}

        {!isTransitioning ? (
          <>
        <header className="onboard-pref-header">
          <div className="onboard-pref-eyebrow">Final10 · personalize</div>
          <h1 id="onboard-pref-title" className="onboard-pref-title">
            Let&apos;s find your{" "}
            <span className="onboard-pref-title-accent">first win.</span>
          </h1>
          <p className="onboard-pref-sub">
            Pick 1–3 interests and we&apos;ll pull your Best Move instantly.
          </p>
        </header>

        <div
          className="onboard-pref-grid"
          role="group"
          aria-label="Pick between 1 and 3 interests"
        >
          {INTERESTS.map((interest) => {
            const active = selected.includes(interest.id);
            const style = active
              ? ({ "--chip-accent": interest.accent } as React.CSSProperties)
              : undefined;
            return (
              <button
                key={interest.id}
                type="button"
                className={`onboard-pref-chip ${active ? "is-active" : ""}`}
                style={style}
                aria-pressed={active}
                onClick={() => toggle(interest.id)}
                disabled={isTransitioning}
              >
                <span className="onboard-pref-chip-emoji" aria-hidden>
                  {interest.emoji}
                </span>
                <span className="onboard-pref-chip-label">{interest.label}</span>
                {active ? (
                  <span className="onboard-pref-chip-check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="onboard-pref-counter" aria-live="polite">
          {counterCopy}
        </div>

        <button
          type="button"
          className="onboard-pref-cta"
          onClick={submit}
          disabled={!canSubmit || isTransitioning}
        >
          Find My First Win 🔥
        </button>

        <div className="onboard-pref-reward">
          <SavvyPointsIcon size={22} glow animated />
          <span>
            <strong>+25 Savvy</strong> lands after your first personalized pick.
          </span>
        </div>

        <p className="onboard-pref-secondary">
          You can change this anytime later.
        </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
