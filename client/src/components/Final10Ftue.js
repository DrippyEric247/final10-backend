import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FTUE_ACTION_EVENT,
  FTUE_COMPLETED_KEY,
  FTUE_COPY,
  FTUE_SAVE_EVENT,
  FTUE_STEPS,
  FTUE_STORAGE_KEY,
} from "../lib/ftueConfig";
import SavvyMark from "./SavvyMark";

function loadFtue() {
  try {
    const completed = localStorage.getItem(FTUE_COMPLETED_KEY) === "1";
    const raw = JSON.parse(localStorage.getItem(FTUE_STORAGE_KEY) || "{}");
    return {
      completed,
      step: raw.step || FTUE_STEPS.HOOK,
      actions: Number(raw.actions) || 0,
      firstSaveDone: Boolean(raw.firstSaveDone),
    };
  } catch {
    return { completed: false, step: FTUE_STEPS.HOOK, actions: 0, firstSaveDone: false };
  }
}

function saveFtue(next) {
  try {
    localStorage.setItem(
      FTUE_STORAGE_KEY,
      JSON.stringify({
        step: next.step,
        actions: next.actions,
        firstSaveDone: next.firstSaveDone,
      })
    );
    if (next.completed) {
      localStorage.setItem(FTUE_COMPLETED_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

export default function Final10Ftue({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState(() => loadFtue());
  const [rewardPop, setRewardPop] = useState(false);
  const [anchor, setAnchor] = useState(null);

  const isRouteExcluded =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/pricing";

  const active = Boolean(user) && !state.completed && !isRouteExcluded;

  useEffect(() => {
    saveFtue(state);
  }, [state]);

  useEffect(() => {
    if (!active) return;
    if (state.step !== FTUE_STEPS.GUIDE) return;

    const syncAnchor = () => {
      const el = document.querySelector('[data-ftue-save-button="true"]');
      if (!el) {
        setAnchor(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setAnchor({
        x: Math.max(12, Math.min(window.innerWidth - 230, r.left)),
        y: Math.max(12, r.top - 78),
      });
    };

    syncAnchor();
    const t = window.setInterval(syncAnchor, 450);
    window.addEventListener("resize", syncAnchor);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", syncAnchor);
    };
  }, [active, state.step, location.pathname]);

  useEffect(() => {
    if (!active) return;

    const onAnyAction = () => {
      setState((prev) => ({ ...prev, actions: prev.actions + 1 }));
    };
    const onSave = () => {
      setState((prev) => {
        const nextActions = prev.actions + 1;
        const next = { ...prev, actions: nextActions };
        if (!prev.firstSaveDone) {
          setRewardPop(true);
          window.setTimeout(() => setRewardPop(false), 2100);
          next.firstSaveDone = true;
          if (prev.step === FTUE_STEPS.GUIDE) {
            next.step = FTUE_STEPS.SYSTEMS;
          }
        }
        return next;
      });
    };

    window.addEventListener(FTUE_ACTION_EVENT, onAnyAction);
    window.addEventListener(FTUE_SAVE_EVENT, onSave);
    return () => {
      window.removeEventListener(FTUE_ACTION_EVENT, onAnyAction);
      window.removeEventListener(FTUE_SAVE_EVENT, onSave);
    };
  }, [active]);

  const skipAll = () => {
    setState((prev) => ({ ...prev, completed: true, step: FTUE_STEPS.DONE }));
  };

  const nextStep = (step) => {
    setState((prev) => ({ ...prev, step }));
  };

  const prompt = useMemo(() => {
    if (!active) return null;
    if (state.step === FTUE_STEPS.SYSTEMS) return FTUE_COPY.systems;
    if (state.step === FTUE_STEPS.FUTURE) return FTUE_COPY.future;
    if (state.step === FTUE_STEPS.SEASON) return FTUE_COPY.season;
    if (state.step === FTUE_STEPS.DAILY) return FTUE_COPY.daily;
    return null;
  }, [active, state.step]);

  if (!active) return null;

  const needsOneMoreAction = state.step === FTUE_STEPS.FUTURE && state.actions < 2;

  return (
    <>
      {(state.step === FTUE_STEPS.HOOK || state.step === FTUE_STEPS.POWER) && (
        <div className="f10-ftue-fullscreen">
          <div className="f10-ftue-card">
            <button type="button" className="f10-ftue-skip" onClick={skipAll}>
              Skip
            </button>
            <div style={{ marginBottom: 10 }}>
              <SavvyMark variant="brand" size={26} glow animated />
            </div>
            <h2>{state.step === FTUE_STEPS.HOOK ? FTUE_COPY.hook.title : FTUE_COPY.power.title}</h2>
            <p>{state.step === FTUE_STEPS.HOOK ? FTUE_COPY.hook.body : FTUE_COPY.power.body}</p>
            <button
              type="button"
              className="f10-ftue-btn"
              onClick={() => {
                if (state.step === FTUE_STEPS.HOOK) {
                  nextStep(FTUE_STEPS.POWER);
                  return;
                }
                nextStep(FTUE_STEPS.GUIDE);
                if (location.pathname !== "/auctions") {
                  navigate("/auctions");
                }
              }}
            >
              {state.step === FTUE_STEPS.HOOK ? FTUE_COPY.hook.cta : FTUE_COPY.power.cta}
            </button>
          </div>
        </div>
      )}

      {state.step === FTUE_STEPS.GUIDE && (
        <div
          className="f10-ftue-tip"
          style={anchor ? { left: `${anchor.x}px`, top: `${anchor.y}px` } : undefined}
        >
          <div className="f10-ftue-tip-title">{FTUE_COPY.guide.title}</div>
          <div className="f10-ftue-tip-actions">
            <button type="button" className="f10-ftue-link" onClick={skipAll}>
              Skip
            </button>
          </div>
        </div>
      )}

      {rewardPop && (
        <div className="f10-ftue-reward-pop">
          <div className="f10-ftue-reward-title">{FTUE_COPY.instantReward.title}</div>
          <div className="f10-ftue-reward-sub">{FTUE_COPY.instantReward.body}</div>
        </div>
      )}

      {prompt && (
        <div className="f10-ftue-mini-card">
          <button type="button" className="f10-ftue-skip-mini" onClick={skipAll}>
            Close
          </button>
          <h4>{prompt.title}</h4>
          {"body" in prompt && prompt.body ? <p>{prompt.body}</p> : null}
          {"lines" in prompt && Array.isArray(prompt.lines) ? (
            <div className="f10-ftue-lines">
              {prompt.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}
          {"foot" in prompt && prompt.foot ? <small>{prompt.foot}</small> : null}
          <div className="f10-ftue-mini-actions">
            {state.step === FTUE_STEPS.SEASON ? (
              <button
                type="button"
                className="f10-ftue-btn"
                onClick={() => {
                  navigate("/battle-pass");
                  nextStep(FTUE_STEPS.DAILY);
                }}
              >
                {prompt.cta}
              </button>
            ) : (
              <button
                type="button"
                className="f10-ftue-btn"
                disabled={needsOneMoreAction}
                onClick={() => {
                  if (state.step === FTUE_STEPS.SYSTEMS) nextStep(FTUE_STEPS.FUTURE);
                  else if (state.step === FTUE_STEPS.FUTURE) nextStep(FTUE_STEPS.SEASON);
                  else if (state.step === FTUE_STEPS.DAILY) {
                    setState((prev) => ({ ...prev, completed: true, step: FTUE_STEPS.DONE }));
                    return;
                  } else nextStep(FTUE_STEPS.DAILY);
                }}
              >
                {needsOneMoreAction ? "Do 1 more action" : prompt.cta}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
