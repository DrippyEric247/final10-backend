import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bug,
  CheckCircle2,
  ClipboardList,
  Flame,
  Gift,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import BugReportModal from "../components/BugReportModal";
import { useSavvyPoints } from "../store/savvyStore";
import {
  FOUNDING_TESTER_MILESTONE_HALF,
  FOUNDING_TESTER_REWARD_FULL_SAVVY,
  FOUNDING_TESTER_REWARD_HALF_SAVVY,
  FOUNDING_TESTER_SYNC_EVENT,
  FOUNDING_TESTER_TASKS,
  FOUNDING_TESTER_TASK_COUNT,
  getFoundingTesterRank,
  getFoundingTesterState,
  getReferralPlaceholder,
  isFoundingTesterBadgeUnlocked,
  refreshFoundingTesterProgress,
  saveFoundingTesterState,
  saveReferralPlaceholder,
  unlockFoundingTesterBadge,
} from "../lib/foundingTesterMission";
import Final10Slogan from "../components/branding/Final10Slogan";

const RANK_LADDER = [
  { tier: 1, label: "Bronze Tester", blurb: "Boots on the ground" },
  { tier: 2, label: "Elite Tester", blurb: "Stress-testing the rails" },
  { tier: 3, label: "Founding Sniper", blurb: "Dialing in accuracy" },
  { tier: 4, label: "OG Savvy Member", blurb: "Builders who ship with us" },
];

function grantMilestonesIfNeeded(effectiveCount, snapshot, awardPoints, setToast, setMissionState) {
  const prevMs = snapshot.rewardedMilestones || [];
  let ms = [...prevMs];
  const messages = [];

  if (effectiveCount >= FOUNDING_TESTER_MILESTONE_HALF && !ms.includes("savvy_500")) {
    ms.push("savvy_500");
    awardPoints("founding_tester", FOUNDING_TESTER_REWARD_HALF_SAVVY, "EPIC", "founding_tester_mid");
    messages.push(`+${FOUNDING_TESTER_REWARD_HALF_SAVVY} Savvy`);
  }

  if (effectiveCount >= FOUNDING_TESTER_TASK_COUNT) {
    if (!ms.includes("savvy_1000")) {
      ms.push("savvy_1000");
      awardPoints("founding_tester", FOUNDING_TESTER_REWARD_FULL_SAVVY, "LEGENDARY", "founding_tester_complete");
      messages.push(`+${FOUNDING_TESTER_REWARD_FULL_SAVVY} Savvy`);
    }
    if (!isFoundingTesterBadgeUnlocked()) {
      unlockFoundingTesterBadge();
      messages.push("Beta Founder title · Exclusive badge");
    }
  }

  if (ms.length !== prevMs.length) {
    const merged = saveFoundingTesterState({ rewardedMilestones: ms });
    setMissionState(merged);
  }

  if (messages.length) {
    setToast(messages.join(" · "));
    window.setTimeout(() => setToast(""), 3600);
  }
}

export default function FoundingTesterMission() {
  const navigate = useNavigate();
  const { awardPoints } = useSavvyPoints();
  const [showBugModal, setShowBugModal] = useState(false);
  const [toast, setToast] = useState("");
  const [missionState, setMissionState] = useState(() => getFoundingTesterState());
  const [referralState, setReferralState] = useState(() => getReferralPlaceholder());
  const [feedbackDraft, setFeedbackDraft] = useState(() => String(getFoundingTesterState().feedbackDraft || ""));

  const refreshGrant = useCallback((snapshot) => {
    const base = snapshot !== undefined && snapshot !== null ? snapshot : getFoundingTesterState();
    const r = refreshFoundingTesterProgress(base);
    setMissionState(r.state);
    grantMilestonesIfNeeded(r.effectiveCount, r.state, awardPoints, setToast, setMissionState);
  }, [awardPoints]);

  useEffect(() => {
    refreshGrant(getFoundingTesterState());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  useEffect(() => {
    const onExternal = () => {
      refreshGrant(getFoundingTesterState());
    };
    window.addEventListener(FOUNDING_TESTER_SYNC_EVENT, onExternal);
    window.addEventListener("storage", onExternal);
    const onVis = () => {
      if (document.visibilityState === "visible") onExternal();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(FOUNDING_TESTER_SYNC_EVENT, onExternal);
      window.removeEventListener("storage", onExternal);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshGrant]);

  useEffect(() => {
    setFeedbackDraft(String(missionState.feedbackDraft || ""));
  }, [missionState.feedbackDraft]);

  const completedSet = useMemo(() => new Set(missionState.completedTaskIds), [missionState.completedTaskIds]);
  const completedCount = completedSet.size;
  const pct = Math.round((completedCount / FOUNDING_TESTER_TASK_COUNT) * 100);
  const rank = getFoundingTesterRank(completedCount);
  const badgeUnlocked = isFoundingTesterBadgeUnlocked() || completedCount >= FOUNDING_TESTER_TASK_COUNT;
  const ms = missionState.rewardedMilestones || [];
  const halfRewardEarned = ms.includes("savvy_500");
  const fullSavvyEarned = ms.includes("savvy_1000");

  const referralCode = useMemo(() => {
    const base = String(referralState.notes || "FOUNDING").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `F10-${(base || "OG").slice(0, 10)}`;
  }, [referralState.notes]);

  function onToggleRealDeal(checked) {
    const ids = new Set(missionState.completedTaskIds);
    if (checked) ids.add("mission_real_deal");
    else ids.delete("mission_real_deal");
    refreshGrant(saveFoundingTesterState({ completedTaskIds: Array.from(ids) }));
  }

  function onSubmitFeedback(e) {
    e.preventDefault();
    const text = feedbackDraft.trim();
    if (text.length < 12) {
      setToast("Add a few more words so we can act on it.");
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    refreshGrant(
      saveFoundingTesterState({
        feedbackSubmitted: true,
        feedbackDraft: text,
      })
    );
    setToast("Thanks — your feedback is logged for the team.");
    window.setTimeout(() => setToast(""), 2800);
  }

  function onBugSubmitted() {
    const next = saveFoundingTesterState({
      bugReportsSubmitted: (missionState.bugReportsSubmitted || 0) + 1,
    });
    setMissionState(next);
  }

  return (
    <div className="min-h-screen bg-[#070712] text-white pt-20 pb-16">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.07]">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-purple-600 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500 blur-[140px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {toast ? (
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm shadow-lg shadow-emerald-900/20">
            {toast}
          </div>
        ) : null}

        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-purple-950/40 to-slate-950/95 p-6 sm:p-8 shadow-2xl shadow-purple-950/30">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                <Flame className="h-3.5 w-3.5" />
                Founding Tester Program
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                You are early. Help shape the future of Final10.
              </h1>
              <p className="text-slate-300 text-lg leading-relaxed">
                This is an early movement — not a sterile QA form. Hunt bugs, ship signal, and earn Savvy while we harden the
                platform together.
              </p>
              <p className="text-sm font-medium text-cyan-200/90 italic border-l-2 border-cyan-400/50 pl-4">
                Community Tested Builds Improve Faster
              </p>
              <Final10Slogan variant="banner" as="p" className="pt-1" />
            </div>
            <div
              className={`rounded-2xl border bg-gradient-to-br px-5 py-4 shadow-lg ${rank.accent} border-white/15 ring-2 ${rank.ring}`}
            >
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/70">Your rank</div>
              <div className="mt-1 text-xl font-black">{rank.label}</div>
              {badgeUnlocked ? (
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/95">Beta Founder</div>
              ) : null}
              <div className="mt-2 text-xs text-white/75">{completedCount}/{FOUNDING_TESTER_TASK_COUNT} missions</div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap gap-2 mb-5">
              {RANK_LADDER.map((step) => {
                const active = rank.tier === step.tier;
                const passed = rank.tier > step.tier;
                return (
                  <div
                    key={step.label}
                    className={`flex-1 min-w-[140px] rounded-xl border px-3 py-2 transition-colors ${
                      active
                        ? "border-amber-300/60 bg-amber-500/15 shadow-inner shadow-amber-900/30"
                        : passed
                          ? "border-emerald-500/25 bg-emerald-500/5 opacity-90"
                          : "border-white/10 bg-black/20 opacity-70"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-white/50">Tier {step.tier}</div>
                    <div className="text-sm font-bold leading-snug">{step.label}</div>
                    <div className="text-[11px] text-white/55 mt-0.5">{step.blurb}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
              <span>Mission progress</span>
              <span className="font-semibold text-white">{pct}% complete</span>
            </div>
            <div className="h-3 rounded-full bg-black/50 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-bold">Rewards</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <RewardPill
              icon={<Sparkles className="h-4 w-4" />}
              title={`+${FOUNDING_TESTER_REWARD_HALF_SAVVY} Savvy`}
              subtitle="Mid-program surge"
              unlocked={completedCount >= FOUNDING_TESTER_MILESTONE_HALF}
              earned={halfRewardEarned}
            />
            <RewardPill
              icon={<Star className="h-4 w-4" />}
              title={`+${FOUNDING_TESTER_REWARD_FULL_SAVVY} Savvy`}
              subtitle="Full founding run"
              unlocked={completedCount >= FOUNDING_TESTER_TASK_COUNT}
              earned={fullSavvyEarned}
            />
            <RewardPill
              icon={<Shield className="h-4 w-4" />}
              title="Exclusive badge"
              subtitle="Visible across beta"
              unlocked={badgeUnlocked}
              earned={badgeUnlocked}
            />
            <RewardPill
              icon={<Trophy className="h-4 w-4" />}
              title="Beta Founder title"
              subtitle="Reserved for finishers"
              unlocked={badgeUnlocked}
              earned={badgeUnlocked}
            />
            <RewardPill
              icon={<Users className="h-4 w-4" />}
              title="Future premium perks"
              subtitle="Early access lanes unlock later"
              unlocked={badgeUnlocked}
              earned={badgeUnlocked}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-bold">Mission checklist</h2>
          </div>
          <div className="space-y-3">
            {FOUNDING_TESTER_TASKS.map((task) => {
              const done = completedSet.has(task.id);
              if (task.id === "mission_share_feedback") {
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" /> : null}
                      <div>
                        <div className="font-semibold">{task.label}</div>
                        <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                      </div>
                      {done ? (
                        <span className="ml-auto text-xs font-bold uppercase tracking-wide text-emerald-300">Done</span>
                      ) : null}
                    </div>
                    {!done ? (
                      <form onSubmit={onSubmitFeedback} className="space-y-2">
                        <textarea
                          value={feedbackDraft}
                          onChange={(e) => setFeedbackDraft(e.target.value)}
                          rows={4}
                          placeholder="What should we double down on? What feels rough?"
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none resize-y min-h-[100px]"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold hover:opacity-95"
                        >
                          Send feedback
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500 border border-white/10 rounded-lg px-3 py-2 bg-black/30">
                        Submitted — thank you for shaping the build.
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={task.id}
                  className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${
                    done ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-black/25"
                  }`}
                >
                  {task.auto ? (
                    <div className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <div className="h-5 w-5 rounded border border-white/25 bg-black/40" aria-hidden />
                      )}
                    </div>
                  ) : (
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => onToggleRealDeal(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-emerald-500 shrink-0"
                      aria-label={task.label}
                    />
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold flex flex-wrap items-center gap-2">
                      {task.label}
                      {task.auto ? (
                        <span className="text-[10px] uppercase tracking-wider text-cyan-300/90 border border-cyan-500/30 rounded-full px-2 py-0.5">
                          Live sync
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                  </div>
                  {task.path ? (
                    <button
                      type="button"
                      onClick={() => navigate(task.path)}
                      className="text-xs rounded-xl border border-indigo-400/35 bg-indigo-500/15 px-3 py-2 font-semibold hover:bg-indigo-500/25"
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-950/30 to-slate-950/80 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-200" />
            <h3 className="font-bold text-lg">Invite lane</h3>
          </div>
          <p className="text-sm text-slate-300">
            Sharing early access counts toward your checklist. Full referral accounting lands soon — use this block to rehearse
            copy and track invites.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-amber-100 text-sm">{referralCode}</code>
            <span className="text-xs text-slate-400">
              Invites logged: {referralState.invitesSent} · Joined: {referralState.referralsJoined}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                const next = saveReferralPlaceholder({ invitesSent: referralState.invitesSent + 1 });
                setReferralState(next);
                refreshGrant();
              }}
            >
              + Log invite sent
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              onClick={() => {
                const next = saveReferralPlaceholder({ referralsJoined: referralState.referralsJoined + 1 });
                setReferralState(next);
                refreshGrant();
              }}
            >
              + Log friend joined
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-rose-400/25 bg-rose-950/20 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-xl">
            <Bug className="h-6 w-6 text-rose-300 shrink-0" />
            <div>
              <div className="font-bold">Bug reports</div>
              <p className="text-sm text-slate-300 mt-1">
                Something broken or wildly confusing? File a structured bug — engineers see the full trace privately while testers
                keep a clean surface.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBugModal(true)}
            className="rounded-xl border border-rose-400/45 bg-rose-500/15 px-5 py-2.5 text-sm font-semibold hover:bg-rose-500/25 shrink-0"
          >
            Report a bug
          </button>
        </section>
      </div>

      <BugReportModal
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
        onReportSubmitted={onBugSubmitted}
      />
    </div>
  );
}

function RewardPill({ icon, title, subtitle, unlocked, earned }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex gap-3 items-start ${
        unlocked ? "border-emerald-500/35 bg-emerald-500/10" : "border-white/10 bg-black/25 opacity-80"
      }`}
    >
      <div className={`rounded-lg p-2 ${unlocked ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400"}`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
        <div className="text-[11px] mt-2 font-medium uppercase tracking-wide text-slate-500">
          {unlocked ? (earned ? "Unlocked" : "Eligible — stay on mission") : "Locked"}
        </div>
      </div>
    </div>
  );
}
