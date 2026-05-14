import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import {
  getAttribution,
  markAttributionBannerDismissed,
} from "../../lib/attribution";
import {
  hasCompletedFirstSixty,
  markFirstSixtyCompleted,
  markFirstSixtyVisited,
} from "../../lib/firstRunState";
import { hasCompletedOnboarding } from "../../lib/onboardingPreferences";
import "../../styles/FirstSixtyLanding.css";

type Step = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
};

const STEPS_BASE: ReadonlyArray<Step> = [
  {
    id: "what",
    eyebrow: "What Final10 does",
    title: "Spend smarter on the last 10 minutes.",
    body: "We watch live deals and surface only the ones worth your move.",
    visual: <span aria-hidden>⏱️</span>,
  },
  {
    id: "best-move",
    eyebrow: "What Best Move means",
    title: "One clear call: bid, buy, watch, or pass.",
    body: "Every listing is scored on value, timing, and competition. No guesswork.",
    visual: <span aria-hidden>🎯</span>,
  },
  {
    id: "savvy",
    eyebrow: "What Savvy is",
    title: "Earn Savvy on every smart action.",
    body: "One balance, portable across the Savvy ecosystem. The more you move, the more it stacks.",
    visual: <SavvyPointsIcon size={48} glow animated />,
  },
  {
    id: "dual-earn",
    eyebrow: "Buy or sell — you earn",
    title: "Buy or Sell — You Earn Either Way",
    body:
      "Buyers earn Savvy for smart purchases. Sellers earn Savvy when their items get attention or sell.",
    visual: (
      <div className="first60-dual-visual" aria-hidden>
        <span className="first60-dual-visual-pill first60-dual-visual-pill--buyer">
          <span className="first60-dual-visual-pill-icon">🛒</span>
          <span>
            Buyer <strong>+120</strong>
          </span>
        </span>
        <span className="first60-dual-visual-plus">+</span>
        <span className="first60-dual-visual-pill first60-dual-visual-pill--seller">
          <span className="first60-dual-visual-pill-icon">🏷️</span>
          <span>
            Seller <strong>+80</strong>
          </span>
        </span>
      </div>
    ),
  },
  {
    id: "trust",
    eyebrow: "Why trust matters",
    title: "Built-in trust on every pick.",
    body: "Transparent trust scores. Reviewed sellers. Weak deals never make it to Best Move.",
    visual: <span aria-hidden>🛡️</span>,
  },
];

type FirstSixtyLandingProps = {
  /** Force-show even if dismissed. Used for "Show intro" links. */
  force?: boolean;
  /** Called when the user explicitly dismisses or completes. */
  onDismiss?: () => void;
};

export default function FirstSixtyLanding({ force, onDismiss }: FirstSixtyLandingProps) {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [open, setOpen] = useState<boolean>(() => {
    if (force) return true;
    return !hasCompletedFirstSixty();
  });

  const attribution = useMemo(() => getAttribution(), []);

  useEffect(() => {
    if (open) markFirstSixtyVisited();
  }, [open]);

  if (!open) return null;

  const finish = () => {
    markFirstSixtyCompleted();
    markAttributionBannerDismissed();
    setOpen(false);
    onDismiss?.();
  };

  const goToSignup = () => {
    finish();
    navigate("/register");
  };

  const goToBestMove = () => {
    finish();
    // Anonymous visitors asking to see their Best Move first still flow
    // through the preference picker so the first result feels personal,
    // not generic. Already-personalized returning visitors skip ahead.
    navigate(hasCompletedOnboarding() ? "/auctions" : "/onboarding/preferences");
  };

  const step = STEPS_BASE[stepIdx];
  const isLast = stepIdx === STEPS_BASE.length - 1;
  const creatorBanner = attribution?.creatorHandle ? (
    <div className="first60-creator-pill" role="status" aria-live="polite">
      <span className="first60-creator-pill-dot" aria-hidden />
      <span>
        You joined through{" "}
        <strong>@{attribution.creatorHandle}</strong>
        {attribution.creatorCode ? (
          <>
            {" "}— code{" "}
            <strong className="first60-creator-pill-code">
              {attribution.creatorCode}
            </strong>{" "}
            will auto-apply
          </>
        ) : null}
      </span>
    </div>
  ) : null;

  return (
    <div
      className="first60-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first60-title"
    >
      <div className="first60-shell">
        <button
          type="button"
          className="first60-close"
          onClick={finish}
          aria-label="Dismiss intro"
        >
          ×
        </button>

        <header className="first60-header">
          <div className="first60-eyebrow">Final10 in 60 seconds</div>
          <h1 id="first60-title" className="first60-headline">
            Spend smarter. Earn Savvy.{" "}
            <span className="first60-headline-accent">
              Follow the Best Move.
            </span>
          </h1>
          {creatorBanner}
        </header>

        <section className="first60-step" aria-live="polite">
          <div
            className="first60-step-counter"
            aria-label={`Step ${stepIdx + 1} of ${STEPS_BASE.length}`}
          >
            Step {stepIdx + 1} <span className="first60-step-counter-sep">of</span>{" "}
            {STEPS_BASE.length}
          </div>
          <div className="first60-step-visual">{step.visual}</div>
          <div className="first60-step-eyebrow">{step.eyebrow}</div>
          <h2 className="first60-step-title">{step.title}</h2>
          <p className="first60-step-body">{step.body}</p>
        </section>

        <div className="first60-reward-preview" aria-label="First reward preview">
          <SavvyPointsIcon size={28} glow />
          <div className="first60-reward-copy">
            <div className="first60-reward-title">
              Sign up and instantly get{" "}
              <strong>+100 Savvy</strong> on your first action.
            </div>
            <div className="first60-reward-sub">
              Bonus stacks if you arrived via a creator link.
            </div>
          </div>
        </div>

        <div className="first60-dots" role="tablist" aria-label="Intro steps">
          {STEPS_BASE.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === stepIdx}
              aria-label={`Step ${idx + 1}: ${s.eyebrow}`}
              className={`first60-dot ${idx === stepIdx ? "is-active" : ""}`}
              onClick={() => setStepIdx(idx)}
            />
          ))}
        </div>

        <div className="first60-actions">
          <button
            type="button"
            className="first60-btn first60-btn-ghost"
            onClick={() => setStepIdx((v) => Math.max(0, v - 1))}
            disabled={stepIdx === 0}
          >
            Back
          </button>
          {!isLast ? (
            <button
              type="button"
              className="first60-btn first60-btn-primary"
              onClick={() => setStepIdx((v) => Math.min(STEPS_BASE.length - 1, v + 1))}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="first60-btn first60-btn-primary"
              onClick={goToSignup}
            >
              Create Account
            </button>
          )}
        </div>

        <div className="first60-secondary">
          <button
            type="button"
            className="first60-link"
            onClick={goToBestMove}
          >
            Show me the Best Move first
          </button>
          <span className="first60-sep">·</span>
          <Link
            to="/login"
            className="first60-link"
            onClick={finish}
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
