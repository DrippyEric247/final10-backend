import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Share2, Trophy, Vote, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  claimBuildWarsRankReward,
  enterBuildWars,
  getBuildWarsConfig,
  getBuildWarsLeaderboard,
  getBuildWarsMe,
  getProjectAlerts,
  voteBuildWarsEntry,
} from "../lib/api";

type LeaderRow = {
  entryId: string;
  rank: number;
  userId?: string;
  username: string;
  buildType: string;
  finalScore: number;
  savingsUsd: number;
  savvyPointsEarned: number;
  trustLevel: number;
  itemCount: number;
  communityVotes: number;
};

type ProjectOpt = { _id: string; name: string; category?: string; status?: string };

function formatCountdown(endsAt: string) {
  const end = new Date(endsAt).getTime();
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

export default function BuildWarsPage() {
  const auth = useAuth() as unknown as { user?: { _id?: string; id?: string } } | null;
  const user = auth?.user;
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [me, setMe] = useState<Record<string, unknown> | null>(null);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [c, lb] = await Promise.all([getBuildWarsConfig(), getBuildWarsLeaderboard(50)]);
      setCfg(c);
      setLeaderboard(lb.entries || []);
      setTotal(lb.total || 0);
      if (user) {
        const [m, pr] = await Promise.all([getBuildWarsMe(), getProjectAlerts().catch(() => [])]);
        setMe(m.entry || null);
        setProjects(Array.isArray(pr) ? pr : []);
      } else {
        setMe(null);
        setProjects([]);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load Build Wars");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shareText = useMemo(() => {
    const entry = me as { savingsUsd?: number; savvyPointsAwarded?: number; finalScore?: number } | null;
    if (!entry) return "";
    const saved = Number(entry.savingsUsd) || 0;
    const pts = Number(entry.savvyPointsAwarded) || 0;
    return `Savvy Build Wars — Saved $${saved.toFixed(0)} + earned ${pts} Savvy on my multi-item build! #Final10`;
  }, [me]);

  const share = async () => {
    const url = `${window.location.origin}/build-wars`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Savvy Build Wars", text: shareText, url });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        setMsg("Copied share text + link.");
        window.setTimeout(() => setMsg(""), 2400);
      }
    } catch {
      setMsg("Could not share — try copying manually.");
      window.setTimeout(() => setMsg(""), 2400);
    }
  };

  const onEnter = async () => {
    if (!projectId) {
      setErr("Pick a project build first.");
      return;
    }
    setErr("");
    try {
      await enterBuildWars(projectId);
      setMsg("You’re in! Participant Savvy granted if eligible.");
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not enter");
    }
  };

  const onVote = async (entryId: string) => {
    setErr("");
    try {
      await voteBuildWarsEntry(entryId);
      setMsg("Vote recorded.");
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Vote failed");
    }
  };

  const onClaim = async () => {
    setErr("");
    try {
      const r = await claimBuildWarsRankReward();
      setMsg(`Claim result: tier ${r.tier || "—"}, +${r.pointsAwarded || 0} Savvy`);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Claim failed");
    }
  };

  const endsAt = cfg?.endsAt ? String(cfg.endsAt) : "";
  const started = Boolean(cfg?.started);
  const ended = Boolean(cfg?.ended);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#12121a] text-white pt-20 pb-16">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-orange-300">Savvy Build Wars</div>
        <h1 className="mb-2 text-3xl font-black sm:text-4xl">Compete on smart multi-item builds</h1>
        <p className="mb-4 max-w-3xl text-sm text-gray-400">
          Enter with a real Project Alert: multiple parts, tracked savings, linked Savvy alerts, and trust targets.
          Scores reward savings (40%), smart sourcing (30%), trust (20%), and community votes (10%). Top builders earn
          Savvy bonuses and badges — everyone gets a small participant reward on entry.
        </p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Savings 40%", d: "Tracked bundle + line-item savings vs budget." },
            { t: "Smart build 30%", d: "Linked alerts, multi-item depth, bundle signals." },
            { t: "Trust 20%", d: "Blended trust floor across your parts list." },
            { t: "Community 10%", d: "Votes from other builders (1 / build / voter)." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-gray-700 bg-gray-900/60 p-3 text-xs text-gray-300">
              <div className="font-bold text-white">{x.t}</div>
              <div className="mt-1 leading-snug text-gray-400">{x.d}</div>
            </div>
          ))}
        </div>

        {loading ? <div className="text-gray-500">Loading…</div> : null}
        {err ? <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</div> : null}
        {msg ? <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{msg}</div> : null}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-4">
            <div className="text-xs text-orange-200/80">Countdown</div>
            <div className="mt-1 text-2xl font-black text-white">{endsAt ? formatCountdown(endsAt) : "—"}</div>
            <div className="mt-1 text-xs text-gray-500">{ended ? "Event closed" : started ? "Event live" : "Starts soon"}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400">Builders entered</div>
            <div className="mt-1 text-2xl font-black text-amber-200">{total}</div>
          </div>
          <div className="rounded-2xl border border-cyan-500/25 bg-gray-900/60 p-4">
            <div className="text-xs text-gray-400">Your status</div>
            <div className="mt-1 text-lg font-bold text-cyan-200">{me ? "Entered" : user ? "Not entered" : "Login to enter"}</div>
          </div>
        </div>

        {user ? (
          <section className="mb-10 rounded-2xl border border-gray-700 bg-gray-900/50 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Zap className="h-5 w-5 text-yellow-400" aria-hidden />
              Enter your build
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Finish a Project Alert on the{" "}
              <Link className="text-cyan-300 underline" to="/alerts">
                Alerts
              </Link>{" "}
              tab (multi items, savings, trust, at least one linked alert), then select it here.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Project build</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-sm"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!started || ended || Boolean(me)}
                onClick={() => void onEnter()}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
              >
                {me ? "Already entered" : "Enter Build Wars"}
              </button>
            </div>
            {ended ? (
              <button
                type="button"
                onClick={() => void onClaim()}
                className="mt-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/20"
              >
                Claim rank / lucky reward
              </button>
            ) : null}
            {me ? (
              <div className="mt-6 rounded-xl border border-gray-700 bg-gray-950/60 p-4">
                <div className="mb-2 text-sm font-bold text-gray-200">Share your completion</div>
                <p className="mb-3 text-xs text-gray-500">{shareText}</p>
                <button
                  type="button"
                  onClick={() => void share()}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share card
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <div className="mb-10 rounded-2xl border border-gray-700 bg-gray-900/40 p-6 text-sm text-gray-400">
            <Link to="/login" className="font-bold text-cyan-300 underline">
              Log in
            </Link>{" "}
            to enter Build Wars with your Project Alerts.
          </div>
        )}

        <section className="rounded-2xl border border-gray-700 bg-gray-900/40 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <Trophy className="h-5 w-5 text-amber-400" aria-hidden />
            Top builds
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Builder</th>
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2 pr-2">Score</th>
                  <th className="pb-2 pr-2">Savings</th>
                  <th className="pb-2 pr-2">Savvy</th>
                  <th className="pb-2 pr-2">Trust</th>
                  <th className="pb-2 pr-2">Votes</th>
                  {user ? <th className="pb-2">Vote</th> : null}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => {
                  const myId = String((user as { _id?: string; id?: string })?._id || (user as { id?: string })?.id || "");
                  const isMine = myId && String(row.userId || "") === myId;
                  return (
                    <tr key={row.entryId || `${row.rank}-${row.username}`} className="border-t border-gray-800">
                      <td className="py-2 pr-2 font-mono text-gray-400">{row.rank}</td>
                      <td className="py-2 pr-2 font-semibold text-gray-100">{row.username}</td>
                      <td className="py-2 pr-2 text-gray-400">{row.buildType}</td>
                      <td className="py-2 pr-2 text-amber-200">{row.finalScore?.toFixed?.(2) ?? row.finalScore}</td>
                      <td className="py-2 pr-2">${Number(row.savingsUsd || 0).toFixed(0)}</td>
                      <td className="py-2 pr-2">{row.savvyPointsEarned}</td>
                      <td className="py-2 pr-2">{row.trustLevel}</td>
                      <td className="py-2 pr-2">{row.communityVotes}</td>
                      {user ? (
                        <td className="py-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-30"
                            disabled={isMine || !started || ended}
                            onClick={() => void onVote(row.entryId)}
                          >
                            <Vote className="h-3 w-3" />
                            Vote
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            One vote per build per account. Voting nudges the community slice of the score (10%). You can&apos;t vote
            for your own entry.
          </p>
        </section>
      </div>
    </div>
  );
}
