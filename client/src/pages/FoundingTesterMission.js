import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BugReportModal from "../components/BugReportModal";
import Final10Slogan from "../components/branding/Final10Slogan";
import {
  attestFoundingTesterTask,
  completeFoundingTesterMission,
  getFoundingTesterProgress,
} from "../lib/api";
import {
  FOUNDING_TESTER_FEEDBACK_MIN,
  FOUNDING_TESTER_MISSION_COUNT,
  formatEstDate,
  formatFoundingTesterCountdown,
} from "../lib/foundingTesterMission";
import FoundersRemainingBanner from "../components/founding/FoundersRemainingBanner";
import FoundingBetaCallingCard from "../components/founding/FoundingBetaCallingCard";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import "../styles/FoundingTesterMission.css";

const SCOUT_IMG = "/assets/perk-machine/savvy-scout-alive.png";

function MissionCard({
  mission,
  feedbackDraft,
  onFeedbackChange,
  onAttest,
  onComplete,
  busy,
  isActive,
}) {
  const charCount = feedbackDraft.length;
  const feedbackReady = charCount >= FOUNDING_TESTER_FEEDBACK_MIN;
  const completed = mission.status === "completed";
  const waiting = mission.status === "waiting";
  const locked = mission.status === "locked" || mission.status === "upcoming";
  const canWork = mission.status === "active";

  return (
    <article
      className={`ft-mission home-card ft-mission--${mission.status}${isActive ? " ft-mission--active" : ""}`}
    >
      <div className="ft-mission__head">
        <div>
          <h3 className="ft-mission__title">
            <span aria-hidden>{mission.emoji}</span> Mission {mission.order}: {mission.title}
          </h3>
          <p className="ft-mission__desc">{mission.taskDescription}</p>
          <ul className="ft-mission__questions">
            {mission.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <span className={`ft-mission__status ft-mission__status--${completed ? "done" : canWork ? "active" : ""}`}>
          {completed ? "Completed" : waiting ? "Unlocks tomorrow" : canWork ? "Active" : locked ? "Locked" : mission.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        Rewards: +{mission.rewards.savvy} Savvy · +{mission.rewards.xp} XP
      </p>

      {!completed && canWork ? (
        <>
          <div className="ft-mission__actions">
            {mission.path ? (
              <Link to={mission.path} className="ft-btn ft-btn--ghost">
                Open task
              </Link>
            ) : null}
            <button
              type="button"
              className="ft-btn ft-btn--ghost"
              disabled={busy || mission.taskReady}
              onClick={() => void onAttest(mission.id)}
            >
              {mission.taskReady ? "✅ Task complete" : "Mark task complete"}
            </button>
          </div>

          {mission.taskReady ? (
            <form
              className="ft-feedback"
              onSubmit={(e) => {
                e.preventDefault();
                void onComplete(mission.id);
              }}
            >
              <label htmlFor={`ft-feedback-${mission.id}`} className="text-sm font-semibold text-slate-200">
                Beta feedback (required)
              </label>
              <textarea
                id={`ft-feedback-${mission.id}`}
                value={feedbackDraft}
                onChange={(e) => onFeedbackChange(e.target.value)}
                placeholder="Share thoughtful feedback — minimum 100 characters."
                disabled={busy}
              />
              <p className={`ft-char-counter${feedbackReady ? " ft-char-counter--ready" : ""}`}>
                {charCount} / {FOUNDING_TESTER_FEEDBACK_MIN} characters
              </p>
              <button type="submit" className="ft-btn ft-btn--primary" disabled={busy || !feedbackReady}>
                {busy ? "Submitting…" : "Complete Mission"}
              </button>
            </form>
          ) : null}
        </>
      ) : null}

      {completed && mission.feedback ? (
        <p className="text-xs text-slate-500 mt-3 border border-white/10 rounded-lg px-3 py-2 bg-black/30">
          Submitted {mission.completedAt ? new Date(mission.completedAt).toLocaleString() : ""}
        </p>
      ) : null}
    </article>
  );
}

export default function FoundingTesterMission() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [showBugModal, setShowBugModal] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [countdownMs, setCountdownMs] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await getFoundingTesterProgress();
      setSnapshot(data);
      if (data?.nextUnlockMs) setCountdownMs(data.nextUnlockMs);
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not load Founding Tester progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!snapshot?.locked || !countdownMs) return undefined;
    const id = window.setInterval(() => {
      setCountdownMs((ms) => Math.max(0, ms - 60000));
    }, 60000);
    return () => window.clearInterval(id);
  }, [snapshot?.locked, countdownMs]);

  const activeMission = useMemo(
    () => snapshot?.missions?.find((m) => m.id === snapshot?.activeMissionId) || null,
    [snapshot]
  );

  const handleAttest = async (missionId) => {
    setBusy(true);
    setToast("");
    try {
      const res = await attestFoundingTesterTask(missionId);
      if (res?.snapshot) setSnapshot(res.snapshot);
      setToast(res?.message || "Task marked complete — add your feedback.");
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not verify task.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (missionId) => {
    const feedback = String(feedbackDrafts[missionId] || "").trim();
    if (feedback.length < FOUNDING_TESTER_FEEDBACK_MIN) {
      setToast(`Feedback must be at least ${FOUNDING_TESTER_FEEDBACK_MIN} characters.`);
      return;
    }
    setBusy(true);
    setToast("");
    try {
      const res = await completeFoundingTesterMission({ missionId, feedback });
      if (res?.snapshot) setSnapshot(res.snapshot);
      const earned = Number(res?.savvyAwarded);
      if (Number.isFinite(earned) && earned > 0) {
        emitPowerToast(earned, res?.message || "Mission complete!");
      }
      setFeedbackDrafts((prev) => ({ ...prev, [missionId]: "" }));

      if (res?.grandReward?.granted) {
        setCelebration({
          ...(res.snapshot?.grandReward || {}),
          legacy: res.snapshot?.legacy,
          founderNumber: res.snapshot?.legacy?.founderNumber,
          username: res.snapshot?.legacy?.username,
          joinedAt: res.snapshot?.legacy?.joinedAt,
        });
      } else {
        setToast(res?.message || "Mission complete!");
      }
    } catch (err) {
      setToast(err?.response?.data?.message || "Could not complete mission.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ft-page">
        <div className="ft-wrap">
          <p className="text-slate-400">Loading Founding Tester missions…</p>
        </div>
      </div>
    );
  }

  const completedCount = snapshot?.completedCount ?? 0;
  const progressPct = snapshot?.progressPct ?? 0;
  const locked = Boolean(snapshot?.locked);
  const showCountdown = locked && countdownMs > 0;

  return (
    <div className="ft-page">
      <div className="ft-wrap">
        {toast ? <div className="ft-toast" role="status">{toast}</div> : null}

        <header className="ft-hero home-card">
          <p className="ft-kicker">Founding Tester Program</p>
          <h1 className="ft-hero__title">Build Final10 with us — one mission per day</h1>
          <p className="ft-hero__body">
            Seven missions. One unlock per calendar day. Complete the task and submit thoughtful feedback to earn Savvy, XP,
            and exclusive rewards.
          </p>
          <Final10Slogan variant="banner" as="p" className="mt-3" />
        </header>

        <section className="home-card">
          <h2 className="text-lg font-black mb-2">🧪 Build Final10 With Us</h2>
          <p className="text-sm text-slate-300 leading-relaxed m-0 mb-4">
            We designed the Founding Tester Program to be completed over several days—not all at once. Taking your time lets
            you experience new features as they&apos;re updated, helping us collect thoughtful feedback and build the
            strongest version of Final10 before launch.
          </p>
          <FoundersRemainingBanner />
        </section>

        <section className="home-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-black m-0">Mission Progress</h2>
            <span className="text-sm font-bold text-violet-200">
              {completedCount} / {FOUNDING_TESTER_MISSION_COUNT} Completed
            </span>
          </div>
          <div className="ft-progress-bar mb-4">
            <div className="ft-progress-bar__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="ft-progress-grid">
            <div className="ft-stat">
              <p className="ft-stat__label">Days remaining</p>
              <p className="ft-stat__value">{snapshot?.daysRemaining ?? "—"}</p>
            </div>
            <div className="ft-stat">
              <p className="ft-stat__label">Est. completion</p>
              <p className="ft-stat__value">{formatEstDate(snapshot?.estimatedCompletionDate)}</p>
            </div>
            <div className="ft-stat">
              <p className="ft-stat__label">Next unlock</p>
              <p className="ft-stat__value ft-stat__value--accent">
                {showCountdown
                  ? formatFoundingTesterCountdown(countdownMs)
                  : locked
                    ? "Tomorrow"
                    : activeMission
                      ? "Now"
                      : snapshot?.allComplete
                        ? "Done"
                        : "—"}
              </p>
            </div>
            <div className="ft-stat">
              <p className="ft-stat__label">Grand reward</p>
              <p className="ft-stat__value">{snapshot?.grandRewardGranted ? "Claimed" : "Locked"}</p>
            </div>
          </div>
        </section>

        {locked && !snapshot?.allComplete ? (
          <div className="ft-unlock-banner">
            <span aria-hidden>⏳</span>
            <div>
              <p className="ft-unlock-banner__title">
                {showCountdown ? snapshot?.nextUnlockLabel || "Next Mission Unlocks In" : "Mission Available Tomorrow"}
              </p>
              {showCountdown ? (
                <p className="ft-unlock-banner__time">{formatFoundingTesterCountdown(countdownMs)}</p>
              ) : (
                <p className="ft-unlock-banner__time">Check back tomorrow — no penalties for taking your time.</p>
              )}
            </div>
          </div>
        ) : null}

        <section>
          <h2 className="text-lg font-black mb-3">Missions</h2>
          <div className="ft-mission-list">
            {(snapshot?.missions || []).map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                isActive={mission.id === snapshot?.activeMissionId && !locked}
                feedbackDraft={feedbackDrafts[mission.id] || ""}
                onFeedbackChange={(text) =>
                  setFeedbackDrafts((prev) => ({ ...prev, [mission.id]: text }))
                }
                onAttest={handleAttest}
                onComplete={handleComplete}
                busy={busy}
              />
            ))}
          </div>
        </section>

        <section className="home-card">
          <h2 className="text-lg font-black mb-3">Reward Preview</h2>
          <div className="ft-rewards-grid">
            <div className={`ft-reward${completedCount >= 4 ? "" : " ft-reward--locked"}`}>
              <p className="ft-reward__title">Mid-run Savvy boosts</p>
              <p className="ft-reward__sub">Per-mission Savvy + XP</p>
            </div>
            <div className={`ft-reward${snapshot?.allComplete ? "" : " ft-reward--locked"}`}>
              <p className="ft-reward__title">🏆 Founding Tester Completed</p>
              <p className="ft-reward__sub">+2,500 Savvy · 1 month Pro</p>
            </div>
            <div className={`ft-reward${snapshot?.grandRewardGranted ? "" : " ft-reward--locked"}`}>
              <p className="ft-reward__title">Exclusive cosmetics</p>
              <p className="ft-reward__sub">Badge · Calling Card · Emblem</p>
            </div>
          </div>
        </section>

        {snapshot?.feedbackHistory?.length ? (
          <section className="home-card">
            <h2 className="text-lg font-black mb-3">Completed Feedback History</h2>
            <ul className="ft-history">
              {snapshot.feedbackHistory.map((row) => (
                <li key={`${row.missionId}-${row.completedAt}`}>
                  <p className="ft-history__meta">
                    {row.title} · {row.completedAt ? new Date(row.completedAt).toLocaleString() : ""}
                  </p>
                  <p className="m-0 whitespace-pre-wrap text-slate-200">{row.feedback}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="home-card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold m-0">Found a bug?</p>
            <p className="text-sm text-slate-400 m-0 mt-1">File a structured report — separate from mission feedback.</p>
          </div>
          <button type="button" className="ft-btn ft-btn--ghost" onClick={() => setShowBugModal(true)}>
            Report a bug
          </button>
        </section>
      </div>

      {celebration ? (
        <div className="ft-celebration" role="dialog" aria-modal="true">
          <motion.div
            className="ft-celebration__card"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <img src={SCOUT_IMG} alt="" className="ft-celebration__scout" />
            <h2 className="ft-celebration__title">🏆 {celebration.title || 'Founding Tester Completed'}</h2>
            <p className="ft-celebration__line text-amber-200 font-black text-lg">
              {celebration.welcomeLine || celebration.legacy?.welcome || 'Welcome to the Founding 100.'}
            </p>
            {celebration.founderNumber ? (
              <FoundingBetaCallingCard
                founderNumber={celebration.founderNumber}
                username={celebration.username}
                joinedAt={celebration.joinedAt}
                programCompleted
                compact
              />
            ) : null}
            <p className="ft-celebration__line">+{celebration.savvy || 2500} Savvy Points</p>
            <p className="ft-celebration__line">+{celebration.proDays || 30} days Final10 Pro</p>
            <p className="ft-celebration__line">🏆 Founder Calling Card · 🎖 Legacy Badge · ⭐ Founder Emblem</p>
            <p className="ft-celebration__line font-semibold text-amber-100 mt-3">
              {celebration.scoutLine || celebration.legacy?.scoutLine}
            </p>
            <p className="ft-celebration__legacy">📜 Founding Tester Legacy</p>
            <p className="ft-celebration__legacy">{celebration.legacyLine}</p>
            <button
              type="button"
              className="ft-btn ft-btn--primary mt-4"
              onClick={() => {
                setCelebration(null);
                navigate("/profile");
              }}
            >
              View rewards
            </button>
          </motion.div>
        </div>
      ) : null}

      <BugReportModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
    </div>
  );
}
