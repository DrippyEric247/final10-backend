import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POWER_TOAST_EVENT } from "../../lib/final10PowerFeedback";
import { FTUE_ACTION_EVENT } from "../../lib/ftueConfig";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import "../../styles/SavvyFirstRunExperience.css";

const FIRST_RUN_DONE_KEY = "f10_first_run_savvy_done_v1";
const FIRST_POINTS_SEEN_KEY = "f10_first_points_seen_v1";
const POST_BOOT_EVENT = "f10:startup-boot-complete";

type Stage = "idle" | "post_boot" | "cards" | "done";

const CARD_CONTENT = [
  {
    id: "deals",
    title: "Start your run with undervalued deals",
    body: "Scan and browse auctions to spot high-value opportunities quickly.",
    visual: "🔎",
  },
  {
    id: "earn",
    title: "Stack your Savvy balance",
    body: "Every meaningful action helps build your position.",
    visual: "coin",
  },
  {
    id: "universe",
    title: "Use one balance across apps",
    body: "Final10 is part of the Savvy Universe. More apps. More rewards. Same balance.",
    visual: "🌐",
  },
];

function shouldRunForUser(user: unknown) {
  if (!user) return false;
  try {
    return localStorage.getItem(FIRST_RUN_DONE_KEY) !== "1";
  } catch {
    return true;
  }
}

export default function SavvyFirstRunExperience({ user }: { user: unknown }) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [postBootStep, setPostBootStep] = useState<1 | 2>(1);
  const [cardIdx, setCardIdx] = useState(0);
  const [showFirstActionGuide, setShowFirstActionGuide] = useState(false);
  const [showFirstRewardMessage, setShowFirstRewardMessage] = useState(false);
  const [showMomentum, setShowMomentum] = useState(false);
  const [showDelayedReinforcement, setShowDelayedReinforcement] = useState(false);
  const [showYoureInMoment, setShowYoureInMoment] = useState(false);
  const postRewardActionCountRef = useRef(0);
  const firstRewardSeenRef = useRef(false);

  const active = useMemo(() => shouldRunForUser(user), [user]);

  useEffect(() => {
    if (!active) return;
    const onBoot = () => {
      setStage("post_boot");
      setPostBootStep(1);
      const t1 = window.setTimeout(() => setPostBootStep(2), 760);
      const t2 = window.setTimeout(() => setStage("cards"), 1580);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    };
    window.addEventListener(POST_BOOT_EVENT, onBoot);
    return () => window.removeEventListener(POST_BOOT_EVENT, onBoot);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (stage !== "done") return;
    setShowYoureInMoment(true);
    const t = window.setTimeout(() => setShowYoureInMoment(false), 2100);
    setShowFirstActionGuide(true);
    return () => window.clearTimeout(t);
  }, [active, stage]);

  useEffect(() => {
    if (!active) return;
    if (!showFirstActionGuide) return;
    const scannerLink = document.querySelector("a[href='/scanner']");
    if (!scannerLink) return;
    scannerLink.classList.add("savvy-firstrun-highlight");
    return () => scannerLink.classList.remove("savvy-firstrun-highlight");
  }, [active, showFirstActionGuide]);

  useEffect(() => {
    if (!active) return;
    const onPointsEarned = (evt: Event) => {
      const d = (evt as CustomEvent<{ points?: number }>).detail;
      const pts = Number(d?.points || 0);
      if (!Number.isFinite(pts) || pts <= 0) return;
      if (firstRewardSeenRef.current) return;
      firstRewardSeenRef.current = true;
      try {
        localStorage.setItem(FIRST_POINTS_SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      setShowFirstActionGuide(false);
      setShowFirstRewardMessage(true);
      setShowMomentum(true);
      window.setTimeout(() => setShowFirstRewardMessage(false), 3000);
      window.setTimeout(() => setShowDelayedReinforcement(true), 45000);
    };
    window.addEventListener(POWER_TOAST_EVENT, onPointsEarned);
    return () => window.removeEventListener(POWER_TOAST_EVENT, onPointsEarned);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onAction = () => {
      if (!firstRewardSeenRef.current) return;
      postRewardActionCountRef.current += 1;
      if (postRewardActionCountRef.current >= 2) {
        setShowMomentum(false);
        setShowDelayedReinforcement(true);
      }
    };
    window.addEventListener(FTUE_ACTION_EVENT, onAction);
    return () => window.removeEventListener(FTUE_ACTION_EVENT, onAction);
  }, [active]);

  if (!active) return null;

  const finishCards = () => {
    try {
      localStorage.setItem(FIRST_RUN_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    setStage("done");
  };

  return (
    <>
      {stage === "post_boot" ? (
        <div className="savvy-firstrun-overlay" role="dialog" aria-modal="true">
          <div className="savvy-firstrun-postboot">
            {postBootStep === 1 ? (
              <div className="savvy-firstrun-copy">You build your Savvy balance here...</div>
            ) : (
              <div className="savvy-firstrun-copy">
                <SavvyPointsIcon size={34} glow animated />
                <span>...and use them across the Savvy Universe</span>
                <span className="savvy-firstrun-icons">🛍️ ✈️ 🎮 ✨</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {stage === "cards" ? (
        <div className="savvy-firstrun-overlay" role="dialog" aria-modal="true">
          <div className="savvy-firstrun-card-shell">
            <button className="savvy-firstrun-skip" onClick={finishCards} type="button">
              Skip
            </button>
            <div className="savvy-firstrun-card">
              <div className="savvy-firstrun-visual" aria-hidden>
                {CARD_CONTENT[cardIdx].visual === "coin" ? (
                  <SavvyPointsIcon size={60} glow animated />
                ) : (
                  <span>{CARD_CONTENT[cardIdx].visual}</span>
                )}
              </div>
              <h3>{CARD_CONTENT[cardIdx].title}</h3>
              <p>{CARD_CONTENT[cardIdx].body}</p>
              <div className="savvy-firstrun-dots">
                {CARD_CONTENT.map((c, idx) => (
                  <button
                    key={c.id}
                    className={`savvy-firstrun-dot ${idx === cardIdx ? "is-active" : ""}`}
                    onClick={() => setCardIdx(idx)}
                    type="button"
                    aria-label={`Go to card ${idx + 1}`}
                  />
                ))}
              </div>
              <div className="savvy-firstrun-actions">
                <button
                  type="button"
                  onClick={() => setCardIdx((v) => Math.max(0, v - 1))}
                  className="savvy-firstrun-btn ghost"
                  disabled={cardIdx === 0}
                >
                  Back
                </button>
                {cardIdx < CARD_CONTENT.length - 1 ? (
                  <button type="button" onClick={() => setCardIdx((v) => Math.min(CARD_CONTENT.length - 1, v + 1))} className="savvy-firstrun-btn">
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={finishCards} className="savvy-firstrun-btn">
                    Start your run
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showFirstActionGuide ? (
        <div className="savvy-firstrun-hint">
          <div className="savvy-firstrun-hint-title">Scan your first deal to start your run and build position</div>
          <button
            type="button"
            className="savvy-firstrun-hint-btn"
            onClick={() => navigate("/scanner")}
          >
            Open scanner
          </button>
        </div>
      ) : null}

      {showFirstRewardMessage ? (
        <div className="savvy-firstrun-reward">
          <SavvyPointsIcon size={42} glow animated />
          <div>
            <div className="savvy-firstrun-reward-title">You just stacked your first Savvy balance</div>
            <div className="savvy-firstrun-reward-sub">Savvy points carry across the ecosystem</div>
          </div>
        </div>
      ) : null}

      {showMomentum ? (
        <div className="savvy-firstrun-momentum">Complete 2 more actions to lock your first status reward</div>
      ) : null}

      {showDelayedReinforcement ? (
        <div className="savvy-firstrun-reinforce">
          <div>Your Savvy balance is persistent.</div>
          <div>It carries across future Savvy apps, rewards, and more.</div>
        </div>
      ) : null}

      {showYoureInMoment ? (
        <div className="savvy-firstrun-yourein">
          <div className="savvy-firstrun-yourein-title">You&apos;re in.</div>
          <div className="savvy-firstrun-yourein-sub">Every action you take builds your Savvy position across the ecosystem.</div>
        </div>
      ) : null}
    </>
  );
}

