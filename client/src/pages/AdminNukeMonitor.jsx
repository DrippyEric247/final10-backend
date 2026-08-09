import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getNukeMonitorSummary,
  getNukeMonitorPlayers,
  getNukeMonitorPlayerDetail,
  simulateNukeProgress,
} from "../lib/api";
import { hasAdminRole } from "../lib/adminAccess";
import { useAuth } from "../context/AuthContext";
import "../styles/AdminNukeMonitor.css";

const SORT_OPTIONS = [
  { value: "progress_desc", label: "Closest to completion" },
  { value: "activity_desc", label: "Newest activity" },
  { value: "qualified", label: "Qualified" },
  { value: "unlocked", label: "Unlocked" },
  { value: "suspicious", label: "Suspicious" },
];

const SIM_PERCENTS = [10, 50, 80, 99, 100];

export default function AdminNukeMonitor() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [players, setPlayers] = useState({ rows: [], total: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("progress_desc");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [sum, list] = await Promise.all([
        getNukeMonitorSummary(),
        getNukeMonitorPlayers({ search, sort }),
      ]);
      setSummary(sum);
      setPlayers(list);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load Nuke Monitor.");
    } finally {
      setBusy(false);
    }
  }, [search, sort]);

  useEffect(() => {
    if (!authLoading && hasAdminRole(user)) load();
  }, [authLoading, user, load]);

  const openDetail = useCallback(async (userId) => {
    setSelectedUserId(userId);
    setDetail(null);
    try {
      const data = await getNukeMonitorPlayerDetail(userId);
      setDetail(data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load player detail.");
    }
  }, []);

  const runSimulate = useCallback(
    async (percent) => {
      if (!selectedUserId) return;
      try {
        await simulateNukeProgress(selectedUserId, percent);
        await openDetail(selectedUserId);
        await load();
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Simulation failed.");
      }
    },
    [selectedUserId, openDetail, load]
  );

  if (authLoading) return <div className="nuke-monitor">Loading…</div>;
  if (!hasAdminRole(user)) {
    return (
      <div className="nuke-monitor">
        <p>Admin access required.</p>
        <Link to="/admin">← Admin hub</Link>
      </div>
    );
  }

  return (
    <div className="nuke-monitor">
      <header className="nuke-monitor__head">
        <div>
          <p className="nuke-monitor__eyebrow">Admin → Rewards</p>
          <h1>Nuke Monitor</h1>
          <p className="nuke-monitor__sub">
            Secret internal tracking — unreleased collection. Players are not notified.
          </p>
        </div>
        <Link to="/admin" className="nuke-monitor__back">
          ← Admin hub
        </Link>
      </header>

      {error ? <div className="nuke-monitor__error">{error}</div> : null}

      {summary ? (
        <div className="nuke-monitor__cards">
          <div className="nuke-monitor__card">
            <span>Total tracked users</span>
            <strong>{summary.totalTrackedUsers}</strong>
          </div>
          <div className="nuke-monitor__card">
            <span>Users with Nuke progress</span>
            <strong>{summary.usersWithProgress}</strong>
          </div>
          <div className="nuke-monitor__card nuke-monitor__card--near">
            <span>Near Nuke ({Math.round((summary.nearThreshold || 0.8) * 100)}%+)</span>
            <strong>{summary.nearNuke}</strong>
          </div>
          <div className="nuke-monitor__card">
            <span>Nuke qualified</span>
            <strong>{summary.qualified}</strong>
          </div>
          <div className="nuke-monitor__card">
            <span>Nuke unlocked</span>
            <strong>{summary.unlocked}</strong>
          </div>
          <div className="nuke-monitor__card nuke-monitor__card--flag">
            <span>Flagged / suspicious</span>
            <strong>{summary.flagged}</strong>
          </div>
        </div>
      ) : null}

      <div className="nuke-monitor__toolbar">
        <input
          type="search"
          placeholder="Search username, email, or user ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="nuke-monitor__layout">
        <div className="nuke-monitor__table-wrap">
          <table className="nuke-monitor__table">
            <thead>
              <tr>
                <th>User</th>
                <th>Requirement</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {players.rows.map((row) => (
                <tr
                  key={`${row.userId}-${row.requirementId}`}
                  className={selectedUserId === row.userId ? "is-selected" : ""}
                  onClick={() => openDetail(row.userId)}
                >
                  <td>
                    <strong>{row.username || "—"}</strong>
                    <small>{row.userId}</small>
                    {row.testData ? <em className="nuke-monitor__test">TEST DATA</em> : null}
                  </td>
                  <td>{row.requirementName}</td>
                  <td>
                    {row.currentValue} / {row.targetValue} ({row.progressPercent}%)
                  </td>
                  <td>{row.eligibility}</td>
                  <td>{row.lastProgressAt ? new Date(row.lastProgressAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {!players.rows.length ? (
                <tr>
                  <td colSpan={5}>No Nuke progress tracked yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedUserId && detail ? (
          <aside className="nuke-monitor__detail">
            <h2>Nuke Player Details</h2>
            <p>
              <strong>{detail.user.username}</strong>
              <br />
              <small>{detail.user.userId}</small>
            </p>
            <p className="nuke-monitor__eligibility">
              Nuke eligibility: <strong>{detail.eligibility}</strong>
            </p>
            <ul className="nuke-monitor__reqs">
              {detail.requirements.map((r) => (
                <li key={r.id}>
                  {r.name}: {r.currentValue}/{r.targetValue} ({r.progressPercent}%) — {r.eligibility}
                </li>
              ))}
            </ul>
            <div className="nuke-monitor__simulate">
              <p>Simulate progress (TEST DATA only):</p>
              <div className="nuke-monitor__sim-btns">
                {SIM_PERCENTS.map((p) => (
                  <button key={p} type="button" onClick={() => runSimulate(p)}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <h3>Recent audit events</h3>
            <ul className="nuke-monitor__events">
              {(detail.events || []).slice(0, 12).map((ev) => (
                <li key={ev.eventId}>
                  {ev.eventType} · {ev.newValue ?? "—"} ·{" "}
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ""}
                  {ev.testData ? " · TEST DATA" : ""}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
