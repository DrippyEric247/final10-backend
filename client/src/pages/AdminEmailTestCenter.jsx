import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasAdminRole } from "../lib/adminAccess";
import {
  getAdminEmailTestHistory,
  searchAdminEmailTestUsers,
  sendAdminTestEmail,
} from "../lib/api";
import SavvyMark from "../components/SavvyMark";
import "../styles/AdminEmailTestCenter.css";

const EMAIL_TYPES = [
  { key: "welcome_email", label: "Welcome Email", emoji: "📧" },
  { key: "verify_email", label: "Verify Email", emoji: "📧" },
  { key: "password_reset", label: "Password Reset", emoji: "📧" },
  { key: "deal_alert", label: "Deal Alert", emoji: "📧" },
  { key: "price_drop_alert", label: "Price Drop Alert", emoji: "📧" },
  { key: "best_move_alert", label: "Best Move Alert", emoji: "📧" },
  { key: "quick_snipe_alert", label: "Quick Snipe Alert", emoji: "📧" },
  { key: "monthly_scout_report", label: "Monthly Scout Report", emoji: "📧" },
  { key: "referral_reward", label: "Referral Reward", emoji: "📧" },
  { key: "founding_tester_reward", label: "Founding Tester Reward", emoji: "📧" },
  { key: "double_points_event", label: "Double Points Event", emoji: "📧" },
  { key: "triple_points_event", label: "Triple Points Event", emoji: "📧" },
  { key: "savvy_sale_event", label: "Savvy Sale Event", emoji: "📧" },
  { key: "max_supply_drop_event", label: "Max Supply Drop Event", emoji: "📧" },
  { key: "custom", label: "Custom Test Email", emoji: "📧" },
];

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function statusLabel(status) {
  if (status === "sent") return "Sent";
  if (status === "log_only") return "Log only (not configured)";
  if (status === "failed") return "Failed";
  return status || "—";
}

export default function AdminEmailTestCenter() {
  const { user, loading } = useAuth();
  const show = hasAdminRole(user);

  const [query, setQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  const [sendBusyKey, setSendBusyKey] = useState("");
  const [sendError, setSendError] = useState("");
  const [lastSend, setLastSend] = useState(null);

  const [customOpen, setCustomOpen] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customButtonText, setCustomButtonText] = useState("");
  const [customButtonUrl, setCustomButtonUrl] = useState("");
  const [customImage, setCustomImage] = useState(null);

  const loadHistory = useCallback(async (userId) => {
    if (!userId) {
      setHistory([]);
      return;
    }
    setHistoryBusy(true);
    try {
      const data = await getAdminEmailTestHistory(userId);
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setSearchError("Enter a username, email, or user ID.");
      return;
    }
    setSearchBusy(true);
    setSearchError("");
    setResults([]);
    setSelected(null);
    setLastSend(null);
    setHistory([]);
    try {
      const data = await searchAdminEmailTestUsers(q);
      const users = Array.isArray(data?.users) ? data.users : [];
      setResults(users);
      if (!users.length) {
        setSearchError("No users matched that search.");
      }
    } catch (err) {
      setSearchError(err?.response?.data?.message || err?.message || "Search failed.");
    } finally {
      setSearchBusy(false);
    }
  }, [query]);

  const selectUser = useCallback(
    (row) => {
      setSelected(row);
      setSendError("");
      setLastSend(null);
      void loadHistory(row.id);
    },
    [loadHistory]
  );

  const handleSend = useCallback(
    async (templateKey) => {
      if (!selected?.id) {
        setSendError("Select a user first.");
        return;
      }
      if (templateKey === "custom") {
        setCustomOpen(true);
        return;
      }

      setSendBusyKey(templateKey);
      setSendError("");
      try {
        const result = await sendAdminTestEmail({
          userId: selected.id,
          templateKey,
        });
        if (result?.ok === false) {
          setSendError(
            result.failureReason ||
              result.errorReason ||
              result.message ||
              result.reason ||
              "Email delivery failed."
          );
          setLastSend(result);
          return;
        }
        setLastSend(result);
        await loadHistory(selected.id);
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                lastEmailSent: {
                  at: result.timestamp,
                  templateKey: result.templateKey,
                  templateLabel: result.templateLabel,
                  status: result.status,
                  deliveryId: result.deliveryId,
                },
              }
            : prev
        );
      } catch (err) {
        const data = err?.response?.data;
        setSendError(
          data?.failureReason ||
            data?.errorReason ||
            data?.message ||
            data?.reason ||
            err?.message ||
            "Send failed."
        );
        setLastSend(data || null);
      } finally {
        setSendBusyKey("");
      }
    },
    [selected, loadHistory]
  );

  const handleCustomSend = useCallback(async () => {
    if (!selected?.id) {
      setSendError("Select a user first.");
      return;
    }
    if (!customSubject.trim() || !customMessage.trim()) {
      setSendError("Custom test requires a subject and message.");
      return;
    }

    setSendBusyKey("custom");
    setSendError("");
    try {
      const result = await sendAdminTestEmail({
        userId: selected.id,
        templateKey: "custom",
        customSubject: customSubject.trim(),
        customMessage: customMessage.trim(),
        buttonText: customButtonText.trim(),
        buttonUrl: customButtonUrl.trim(),
        image: customImage,
      });
      if (result?.ok === false) {
        setSendError(
          result.failureReason ||
            result.errorReason ||
            result.message ||
            result.reason ||
            "Email delivery failed."
        );
        setLastSend(result);
        return;
      }
      setLastSend(result);
      setCustomOpen(false);
      await loadHistory(selected.id);
    } catch (err) {
      const data = err?.response?.data;
      setSendError(
        data?.failureReason ||
          data?.errorReason ||
          data?.message ||
          data?.reason ||
          err?.message ||
          "Send failed."
      );
      setLastSend(data || null);
    } finally {
      setSendBusyKey("");
    }
  }, [
    selected,
    customSubject,
    customMessage,
    customButtonText,
    customButtonUrl,
    customImage,
    loadHistory,
  ]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError("");
    }
  }, [query]);

  const safetyNote = useMemo(
    () =>
      "All sends are marked TEST EMAIL. No rewards, tickets, or real alerts are triggered.",
    []
  );

  if (loading) {
    return (
      <div className="card max-w-lg mx-auto mt-8 flex items-center gap-3">
        <SavvyMark variant="brand" size={24} glow animated />
        <span className="text-gray-300">Loading admin access…</span>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="card max-w-lg mx-auto mt-8">
        <h1 className="text-xl font-bold mb-2">Access denied</h1>
        <p className="text-gray-400 text-sm">Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="admin-email-test max-w-4xl mx-auto mt-6 space-y-6 pb-12">
      <header className="space-y-2">
        <Link to="/admin" className="text-sm text-violet-300 hover:text-violet-200">
          ← Admin
        </Link>
        <h1 className="text-2xl font-bold">Email Test Center</h1>
        <p className="text-gray-400 text-sm">{safetyNote}</p>
      </header>

      <section className="card border border-amber-400/30 bg-amber-500/5 space-y-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] uppercase text-amber-200">Search User</p>
          <p className="text-sm text-gray-300 mt-1">Search by username, email, or user ID.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            className="admin-email-test__input flex-1"
            placeholder="Username, email, or user ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
          <button
            type="button"
            className="admin-email-test__btn admin-email-test__btn--primary"
            onClick={() => void runSearch()}
            disabled={searchBusy}
          >
            {searchBusy ? "Searching…" : "Search"}
          </button>
        </div>
        {searchError ? <p className="text-sm text-red-300">{searchError}</p> : null}

        {results.length ? (
          <ul className="admin-email-test__results">
            {results.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`admin-email-test__result ${
                    selected?.id === row.id ? "admin-email-test__result--active" : ""
                  }`}
                  onClick={() => selectUser(row)}
                >
                  <span className="font-bold text-white">{row.username || "—"}</span>
                  <span className="text-sm text-gray-300">{row.email}</span>
                  <span className="text-xs text-gray-400">
                    Beta: {row.betaStatus} · Sub: {row.subscription}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selected ? (
        <>
          <section className="card space-y-3">
            <p className="text-xs font-black tracking-[0.16em] uppercase text-violet-200">Selected User</p>
            <dl className="admin-email-test__meta">
              <div>
                <dt>Username</dt>
                <dd>{selected.username || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.email || "—"}</dd>
              </div>
              <div>
                <dt>Beta status</dt>
                <dd>{selected.betaStatus || "—"}</dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>{selected.subscription || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt>Last email sent</dt>
                <dd>
                  {selected.lastEmailSent
                    ? `${formatTime(selected.lastEmailSent.at)} · ${selected.lastEmailSent.templateLabel || selected.lastEmailSent.templateKey} · ${statusLabel(selected.lastEmailSent.status)}`
                    : "No test emails yet"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card space-y-4">
            <div>
              <p className="text-xs font-black tracking-[0.16em] uppercase text-cyan-200">Email Types</p>
              <p className="text-sm text-gray-300 mt-1">One-click template preview to {selected.email}.</p>
            </div>
            <div className="admin-email-test__grid">
              {EMAIL_TYPES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="admin-email-test__template-btn"
                  onClick={() => void handleSend(item.key)}
                  disabled={Boolean(sendBusyKey)}
                >
                  <span aria-hidden>{item.emoji}</span>
                  <span>{sendBusyKey === item.key ? "Sending…" : item.label}</span>
                </button>
              ))}
            </div>
            {sendError ? <p className="text-sm text-red-300">{sendError}</p> : null}
          </section>

          {customOpen ? (
            <section className="card border border-fuchsia-400/30 bg-fuchsia-500/5 space-y-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] uppercase text-fuchsia-200">Custom Test</p>
                <p className="text-sm text-gray-300 mt-1">Subject and message required. Image and CTA optional.</p>
              </div>
              <label className="admin-email-test__field">
                <span>Subject</span>
                <input
                  className="admin-email-test__input"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
              </label>
              <label className="admin-email-test__field">
                <span>Message</span>
                <textarea
                  className="admin-email-test__textarea"
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="admin-email-test__field">
                  <span>Button text (optional)</span>
                  <input
                    className="admin-email-test__input"
                    value={customButtonText}
                    onChange={(e) => setCustomButtonText(e.target.value)}
                  />
                </label>
                <label className="admin-email-test__field">
                  <span>Destination URL (optional)</span>
                  <input
                    className="admin-email-test__input"
                    value={customButtonUrl}
                    onChange={(e) => setCustomButtonUrl(e.target.value)}
                  />
                </label>
              </div>
              <label className="admin-email-test__field">
                <span>Optional image (max 2 MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCustomImage(e.target.files?.[0] || null)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="admin-email-test__btn admin-email-test__btn--primary"
                  onClick={() => void handleCustomSend()}
                  disabled={sendBusyKey === "custom"}
                >
                  {sendBusyKey === "custom" ? "Sending…" : "Send Custom Test"}
                </button>
                <button
                  type="button"
                  className="admin-email-test__btn"
                  onClick={() => setCustomOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}

          {lastSend?.ok ? (
            <section className="card border border-emerald-400/30 bg-emerald-500/10 space-y-2">
              <p className="text-sm font-bold text-emerald-200">✅ {lastSend.message}</p>
              <dl className="admin-email-test__meta">
                <div>
                  <dt>Recipient</dt>
                  <dd>
                    {lastSend.recipient?.username} ({lastSend.recipient?.email})
                  </dd>
                </div>
                <div>
                  <dt>Timestamp</dt>
                  <dd>{formatTime(lastSend.timestamp)}</dd>
                </div>
                <div>
                  <dt>Template</dt>
                  <dd>{lastSend.templateLabel}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(lastSend.status)}</dd>
                </div>
                {lastSend.deliveryId ? (
                  <div>
                    <dt>Delivery ID</dt>
                    <dd className="font-mono text-xs">{lastSend.deliveryId}</dd>
                  </div>
                ) : null}
                {lastSend.messageId ? (
                  <div>
                    <dt>Provider message ID</dt>
                    <dd className="font-mono text-xs break-all">{lastSend.messageId}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black tracking-[0.16em] uppercase text-gray-300">Email History</p>
              {historyBusy ? <span className="text-xs text-gray-500">Loading…</span> : null}
            </div>
            {!history.length && !historyBusy ? (
              <p className="text-sm text-gray-400">No test emails logged for this user yet.</p>
            ) : (
              <ul className="admin-email-test__history">
                {history.map((row) => (
                  <li key={row.id} className="admin-email-test__history-row">
                    <div>
                      <p className="font-semibold text-white">{row.templateLabel}</p>
                      <p className="text-xs text-gray-400">{formatTime(row.sentAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{statusLabel(row.status)}</p>
                      {row.deliveryId ? (
                        <p className="text-xs font-mono text-gray-500">{row.deliveryId}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
