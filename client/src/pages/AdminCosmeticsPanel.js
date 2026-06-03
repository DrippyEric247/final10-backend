// src/pages/AdminCosmeticsPanel.js
//
// Owner or superadmin grant panel for exclusive calling cards and emblems.
// Access is gated by `isCosmeticsAdmin(user)` — true superadmins pass, and a
// localStorage dev-override (`f10_dev_admin=1`) also opens the door during
// development so we never block iteration on backend role plumbing.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  CALLING_CARDS,
  EMBLEMS,
  findCallingCard,
  findEmblem,
} from "../lib/customizationCatalog";
import {
  ADMIN_COSMETICS_UPDATE_EVENT,
  AdminGrantError,
  grantCard,
  isCosmeticsAdmin,
  listAllGrants,
  listGrantsForUser,
  readAuditLog,
  revokeCard,
  userKeyFor,
} from "../lib/adminCosmetics";
import CallingCard from "../components/CallingCard";
import "../styles/CallingCard.css";
import "../styles/AdminCosmeticsPanel.css";

const GROUP_ORDER = [
  { id: "exclusive_founders", label: "Founders / Elite", accent: "gold" },
  { id: "exclusive_influencer", label: "Influencer", accent: "pink" },
  { id: "exclusive_dev", label: "Developer", accent: "cyan" },
];

function groupItems(items) {
  const by = new Map(GROUP_ORDER.map((g) => [g.id, []]));
  const other = [];
  for (const item of items) {
    if (item.rarity !== "exclusive") continue;
    if (by.has(item.group)) by.get(item.group).push(item);
    else other.push(item);
  }
  if (other.length) by.set("_other", other);
  return by;
}

function formatTime(ts) {
  const t = Number(ts) || 0;
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

export default function AdminCosmeticsPanel() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [targetKey, setTargetKey] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const canManage = isCosmeticsAdmin(user);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(ADMIN_COSMETICS_UPDATE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(ADMIN_COSMETICS_UPDATE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const cardGroups = useMemo(() => {
    void tick;
    return groupItems(CALLING_CARDS);
  }, [tick]);

  const emblemGroups = useMemo(() => {
    void tick;
    return groupItems(EMBLEMS);
  }, [tick]);

  const targetGrants = useMemo(() => {
    void tick;
    const key = targetKey.trim();
    return key ? listGrantsForUser(key) : [];
  }, [tick, targetKey]);

  const allGrants = useMemo(() => {
    void tick;
    return listAllGrants().slice(0, 25);
  }, [tick]);

  const audit = useMemo(() => {
    void tick;
    return readAuditLog(25);
  }, [tick]);

  const doGrant = useCallback(
    (itemId) => {
      const key = targetKey.trim();
      if (!key) {
        setFeedback({ tone: "error", message: "Enter a user id, username, or email first." });
        return;
      }
      try {
        grantCard({
          userKey: key,
          itemId,
          grantedBy: userKeyFor(user) || "admin",
          note: note.trim(),
        });
        setFeedback({ tone: "ok", message: `Granted ${itemId} to ${key}.` });
      } catch (err) {
        setFeedback({
          tone: "error",
          message: err instanceof AdminGrantError ? err.message : "Grant failed.",
        });
      }
    },
    [note, targetKey, user]
  );

  const doRevoke = useCallback(
    (itemId) => {
      const key = targetKey.trim();
      if (!key) return;
      try {
        revokeCard({
          userKey: key,
          itemId,
          revokedBy: userKeyFor(user) || "admin",
          note: note.trim(),
        });
        setFeedback({ tone: "ok", message: `Revoked ${itemId} from ${key}.` });
        setConfirmRevoke(null);
      } catch (err) {
        setFeedback({
          tone: "error",
          message: err instanceof AdminGrantError ? err.message : "Revoke failed.",
        });
      }
    },
    [note, targetKey, user]
  );

  if (!canManage) {
    return (
      <div className="ac-gate">
        <div className="ac-gate-card">
          <h1>Restricted</h1>
          <p>
            The exclusive cosmetics panel is only available to Final10 owners and
            verified admins.
          </p>
          <p className="ac-gate-hint">
            Developers can unlock a local override with
            <code> localStorage.setItem(&quot;f10_dev_admin&quot;,&quot;1&quot;) </code>
            in the browser console, then reload.
          </p>
        </div>
      </div>
    );
  }

  const grantedSet = new Set(targetGrants.map((g) => g.itemId));

  return (
    <div className="ac-page">
      <header className="ac-hero">
        <div>
          <div className="ac-hero-eyebrow">Owner Panel</div>
          <h1>Exclusive Cosmetics</h1>
          <p>
            Grant calling cards + emblems that normal progression can't reach.
            Every change is logged with the granter and timestamp.
          </p>
        </div>
        <dl className="ac-hero-stats">
          <div>
            <dt>Active grants</dt>
            <dd>{allGrants.length}</dd>
          </div>
          <div>
            <dt>Audit entries</dt>
            <dd>{audit.length}</dd>
          </div>
        </dl>
      </header>

      <section className="ac-target">
        <label className="ac-field">
          <span>Target user</span>
          <input
            type="text"
            value={targetKey}
            placeholder="user id, username, or email"
            onChange={(e) => setTargetKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="ac-field ac-field--note">
          <span>Note <em>optional</em></span>
          <input
            type="text"
            value={note}
            placeholder="why is this being granted?"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {targetKey.trim() ? (
          <div className="ac-target-summary">
            {targetGrants.length === 0 ? (
              <span className="ac-pill ac-pill--muted">No grants yet</span>
            ) : (
              targetGrants.map((g) => (
                <span key={g.itemId} className="ac-pill ac-pill--ok">
                  {g.itemId}
                </span>
              ))
            )}
          </div>
        ) : null}
      </section>

      {feedback ? (
        <div className={`ac-feedback ac-feedback--${feedback.tone}`} role="status">
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)}>Dismiss</button>
        </div>
      ) : null}

      <section className="ac-section" aria-label="Exclusive calling cards">
        <h2>Calling cards</h2>
        {GROUP_ORDER.map((group) => {
          const items = cardGroups.get(group.id) || [];
          if (!items.length) return null;
          return (
            <div key={group.id} className={`ac-group ac-group--${group.accent}`}>
              <div className="ac-group-head">
                <h3>{group.label}</h3>
                <small>{items.length} cards</small>
              </div>
              <div className="ac-cards">
                {items.map((card) => {
                  const isGranted = grantedSet.has(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`ac-card-tile ${isGranted ? "ac-card-tile--granted" : ""}`}
                    >
                      <CallingCard
                        title={card.name}
                        subtitle={card.tagline}
                        rarity={card.rarity}
                        isEquipped={false}
                        isUnlocked
                        stripe={card.stripe}
                        flare={card.flare}
                        className="ac-card-banner"
                        showEquippedBadge={false}
                      />
                      <div className="ac-card-meta">
                        <code>{card.id}</code>
                        <small>{card.requirement}</small>
                      </div>
                      <div className="ac-card-actions">
                        {isGranted ? (
                          confirmRevoke === card.id ? (
                            <>
                              <button
                                type="button"
                                className="ac-btn ac-btn--danger"
                                onClick={() => doRevoke(card.id)}
                              >
                                Confirm revoke
                              </button>
                              <button
                                type="button"
                                className="ac-btn ac-btn--ghost"
                                onClick={() => setConfirmRevoke(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="ac-btn ac-btn--ghost"
                              onClick={() => setConfirmRevoke(card.id)}
                            >
                              Revoke
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            className="ac-btn ac-btn--primary"
                            onClick={() => doGrant(card.id)}
                            disabled={!targetKey.trim()}
                          >
                            Grant
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="ac-section" aria-label="Exclusive emblems">
        <h2>Emblems</h2>
        {GROUP_ORDER.map((group) => {
          const items = emblemGroups.get(group.id) || [];
          if (!items.length) return null;
          return (
            <div key={`e-${group.id}`} className={`ac-group ac-group--${group.accent}`}>
              <div className="ac-group-head">
                <h3>{group.label}</h3>
                <small>{items.length} emblems</small>
              </div>
              <div className="ac-emblems">
                {items.map((emblem) => {
                  const isGranted = grantedSet.has(emblem.id);
                  return (
                    <div
                      key={emblem.id}
                      className={`ac-emblem-tile ${isGranted ? "ac-emblem-tile--granted" : ""}`}
                    >
                      <div
                        className="ac-emblem-glyph"
                        style={{ background: emblem.accent }}
                      >
                        {emblem.glyph}
                      </div>
                      <div className="ac-emblem-meta">
                        <strong>{emblem.name}</strong>
                        <code>{emblem.id}</code>
                        <small>{emblem.requirement}</small>
                      </div>
                      <div className="ac-card-actions">
                        {isGranted ? (
                          <button
                            type="button"
                            className="ac-btn ac-btn--ghost"
                            onClick={() => doRevoke(emblem.id)}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ac-btn ac-btn--primary"
                            onClick={() => doGrant(emblem.id)}
                            disabled={!targetKey.trim()}
                          >
                            Grant
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="ac-section" aria-label="Recent activity">
        <h2>Recent grants</h2>
        {allGrants.length === 0 ? (
          <p className="ac-muted">No active grants yet.</p>
        ) : (
          <table className="ac-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Item</th>
                <th>Granted by</th>
                <th>When</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {allGrants.map((g, i) => {
                const label =
                  findCallingCard(g.itemId)?.name ||
                  findEmblem(g.itemId)?.name ||
                  g.itemId;
                return (
                  <tr key={`${g.userKey}-${g.itemId}-${i}`}>
                    <td><code>{g.userKey}</code></td>
                    <td>{label} <code className="ac-muted">{g.itemId}</code></td>
                    <td><code>{g.grantedBy}</code></td>
                    <td>{formatTime(g.grantedAt)}</td>
                    <td>{g.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="ac-section" aria-label="Audit log">
        <h2>Audit log <small>(last 25)</small></h2>
        {audit.length === 0 ? (
          <p className="ac-muted">No activity logged yet.</p>
        ) : (
          <ul className="ac-audit">
            {audit.map((entry, i) => (
              <li key={i} className={`ac-audit-row ac-audit-row--${entry.action}`}>
                <span className="ac-audit-action">{entry.action}</span>
                <span className="ac-audit-item">{entry.itemId}</span>
                <span>→</span>
                <code>{entry.userKey}</code>
                <span className="ac-muted">by</span>
                <code>{entry.grantedBy}</code>
                <time>{formatTime(entry.at)}</time>
                {entry.note ? <em>“{entry.note}”</em> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
