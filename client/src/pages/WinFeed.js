// src/pages/WinFeed.js
//
// Savvy Wins — social-proof feed of real user wins. Mounted at /win-feed.
// All data is client-side today (see lib/winFeed.js) so the page works even
// without a backend; when /api/wins exists, swap the service imports.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  WIN_CATEGORIES,
  WIN_CATEGORY_LABELS,
  WIN_VERIFICATION,
  WinSubmissionError,
  autoTitle,
  computeFeedStats,
  computeReward,
  computeWeeklyHighlights,
  decorateWin,
  listWins,
  normalizeTags,
  readTodaySubmissionCount,
  resolveWinCosmetics,
  submitWin,
  _internal,
} from "../lib/winFeed";
import { recordScoutMissionAction } from "../lib/savvyScoutMissions";
import Final10SocialLinks from "../components/Final10SocialLinks";
import CallingCard from "../components/CallingCard";
import "../styles/WinFeed.css";

const FILTERS = [
  { id: "all", label: "All Wins" },
  { id: "verified", label: "Verified" },
  { id: "big", label: "Biggest Saves" },
  { id: "fast", label: "Fastest Snipes" },
  { id: "hot", label: "Hot Now" },
];

const MAX_IMAGE_BYTES = 900 * 1024; // 900 KB dataURL guard

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatRelative(ts) {
  const t = Number(ts) || 0;
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

function verificationMeta(v) {
  switch (v) {
    case WIN_VERIFICATION.VERIFIED:
      return { label: "Verified", icon: "✅", cls: "wf-verify--verified" };
    case WIN_VERIFICATION.SCREENSHOT:
      return { label: "Screenshot", icon: "📸", cls: "wf-verify--screenshot" };
    default:
      return { label: "Unverified", icon: "•", cls: "wf-verify--unverified" };
  }
}

/** Applies the current filter + keeps stable sort (priority then createdAt). */
function filterAndSort(wins, filter) {
  const list = wins.map(decorateWin);
  let filtered = list;
  if (filter === "verified") {
    filtered = list.filter((w) => w.verification === WIN_VERIFICATION.VERIFIED);
  } else if (filter === "big") {
    filtered = [...list].sort((a, b) => (b.savings || 0) - (a.savings || 0));
    return filtered;
  } else if (filter === "fast") {
    filtered = list.filter((w) => (w.secondsToWin || 0) > 0);
    return filtered.sort((a, b) => a.secondsToWin - b.secondsToWin);
  } else if (filter === "hot") {
    filtered = list.filter((w) => w.isHot || w.isElite);
  }
  return filtered.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

// ---------------------------------------------------------------------------
// Post-your-win modal
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  productName: "",
  title: "",
  savings: "",
  purchasePrice: "",
  marketValue: "",
  category: "gaming",
  trustScore: 80,
  verification: WIN_VERIFICATION.SCREENSHOT,
  proofUrl: "",
  secondsToWin: "",
  tags: "",
  image: null,
};

function PostYourWinModal({ open, onClose, onSubmit, defaultUsername, todayCount }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setImagePreview(null);
      setError("");
      setBusy(false);
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const previewReward = useMemo(
    () =>
      computeReward({
        savings: form.savings,
        trustScore: form.trustScore,
        verification: form.verification,
      }),
    [form.savings, form.trustScore, form.verification]
  );

  const previewTitle = useMemo(
    () =>
      form.title.trim() ||
      autoTitle({
        savings: form.savings,
        productName: form.productName,
        category: form.category,
      }),
    [form.title, form.savings, form.productName, form.category]
  );

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (result.length > MAX_IMAGE_BYTES) {
        setError("Image too large — try something under ~700 KB.");
        return;
      }
      set("image", result);
      setImagePreview(result);
      setError("");
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!Number(form.savings) || Number(form.savings) <= 0) {
      setError("Enter a savings amount greater than $0.");
      return;
    }
    setBusy(true);
    try {
      const result = onSubmit({
        ...form,
        title: previewTitle,
        tags: form.tags,
      });
      if (result && typeof result.then === "function") await result;
      onClose(true);
    } catch (err) {
      setError(err?.message || "Could not post that win.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const remaining = Math.max(0, _internal.MAX_PER_DAY - (todayCount || 0));

  return (
    <div className="wf-modal-backdrop" role="dialog" aria-modal="true" onClick={() => onClose(false)}>
      <div className="wf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wf-modal-header">
          <div>
            <div className="wf-modal-eyebrow">Savvy Wins</div>
            <h2>Post your win</h2>
          </div>
          <button type="button" className="wf-modal-close" onClick={() => onClose(false)}>
            ✕
          </button>
        </div>

        <div className="wf-modal-rate">
          {remaining > 0
            ? `${remaining} of ${_internal.MAX_PER_DAY} submissions left today`
            : "Daily limit reached — try again tomorrow."}
        </div>

        <form className="wf-form" onSubmit={handleSubmit}>
          <div className="wf-form-grid">
            <label className="wf-field wf-field--wide">
              <span>Proof image</span>
              <div
                className={`wf-dropzone ${imagePreview ? "wf-dropzone--has" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFile(e.dataTransfer.files?.[0]);
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Your win preview" />
                ) : (
                  <div className="wf-dropzone-empty">
                    <span className="wf-dropzone-icon" aria-hidden>🖼️</span>
                    <strong>Drop a screenshot or click</strong>
                    <small>PNG/JPG · keep it under 700 KB</small>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </label>

            <label className="wf-field">
              <span>Product name</span>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => set("productName", e.target.value)}
                placeholder="e.g. PS5 Slim Bundle"
              />
            </label>

            <label className="wf-field">
              <span>Category</span>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {WIN_CATEGORIES.map((id) => (
                  <option key={id} value={id}>{WIN_CATEGORY_LABELS[id]}</option>
                ))}
              </select>
            </label>

            <label className="wf-field">
              <span>Savings ($)</span>
              <input
                type="number"
                min="1"
                value={form.savings}
                onChange={(e) => set("savings", e.target.value)}
                placeholder="120"
                required
              />
            </label>

            <label className="wf-field">
              <span>Purchase price ($) <em>optional</em></span>
              <input
                type="number"
                min="0"
                value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                placeholder="362"
              />
            </label>

            <label className="wf-field">
              <span>Market value ($) <em>optional</em></span>
              <input
                type="number"
                min="0"
                value={form.marketValue}
                onChange={(e) => set("marketValue", e.target.value)}
                placeholder="549"
              />
            </label>

            <label className="wf-field">
              <span>Trust score at purchase</span>
              <input
                type="range"
                min="0"
                max="100"
                value={form.trustScore}
                onChange={(e) => set("trustScore", Number(e.target.value))}
              />
              <small className="wf-range-readout">{form.trustScore}/100</small>
            </label>

            <label className="wf-field">
              <span>Snipe time (seconds) <em>optional</em></span>
              <input
                type="number"
                min="1"
                value={form.secondsToWin}
                onChange={(e) => set("secondsToWin", e.target.value)}
                placeholder="14"
              />
            </label>

            <fieldset className="wf-field wf-field--wide wf-verify-picker">
              <legend>Verification level</legend>
              {[
                { id: WIN_VERIFICATION.VERIFIED, label: "Verified", hint: "Linked purchase proof" },
                { id: WIN_VERIFICATION.SCREENSHOT, label: "Screenshot", hint: "Uploaded proof image" },
                { id: WIN_VERIFICATION.UNVERIFIED, label: "Unverified", hint: "Self-reported" },
              ].map((o) => (
                <label key={o.id} className={`wf-verify-opt ${form.verification === o.id ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name="verification"
                    value={o.id}
                    checked={form.verification === o.id}
                    onChange={() => set("verification", o.id)}
                  />
                  <strong>{o.label}</strong>
                  <small>{o.hint}</small>
                </label>
              ))}
            </fieldset>

            {form.verification === WIN_VERIFICATION.VERIFIED ? (
              <label className="wf-field wf-field--wide">
                <span>Proof URL (order receipt, listing link)</span>
                <input
                  type="url"
                  value={form.proofUrl}
                  onChange={(e) => set("proofUrl", e.target.value)}
                  placeholder="https://www.ebay.com/itm/..."
                />
              </label>
            ) : null}

            <label className="wf-field wf-field--wide">
              <span>Tags</span>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="#PS5 #Gaming #SavvyWins"
              />
            </label>

            <label className="wf-field wf-field--wide">
              <span>Custom title <em>optional — we'll auto-generate one otherwise</em></span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={previewTitle}
              />
            </label>
          </div>

          <aside className="wf-reward-preview">
            <div className="wf-reward-preview-title">
              <span aria-hidden>💰</span> Reward preview
            </div>
            <div className="wf-reward-preview-total">
              +{previewReward.total} <span>points</span>
            </div>
            <ul className="wf-reward-preview-list">
              {previewReward.breakdown.map((b) => (
                <li key={b.label}>
                  <span>{b.label}</span>
                  <strong>+{b.points}</strong>
                </li>
              ))}
            </ul>
          </aside>

          {error ? <div className="wf-form-error">{error}</div> : null}

          <div className="wf-form-actions">
            <button type="button" className="wf-btn wf-btn--ghost" onClick={() => onClose(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="wf-btn wf-btn--primary"
              disabled={busy || remaining === 0}
            >
              {busy ? "Posting…" : `Submit & earn +${previewReward.total}`}
            </button>
          </div>

          <div className="wf-form-author">
            Posting as <strong>{defaultUsername}</strong>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Win card
// ---------------------------------------------------------------------------

function WinCard({ win }) {
  const v = verificationMeta(win.verification);
  const { emblem, callingCard } = resolveWinCosmetics(win);
  const savings = Math.round(Number(win.savings) || 0);
  const savingsPct =
    win.marketValue && Number(win.marketValue) > 0
      ? Math.round((savings / Number(win.marketValue)) * 100)
      : null;

  const classes = [
    "wf-card",
    win.isElite ? "wf-card--elite" : null,
    win.isHot && !win.isElite ? "wf-card--hot" : null,
    win.isFastSnipe ? "wf-card--snipe" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className="wf-card-media">
        {win.image ? (
          <img src={win.image} alt={win.title} loading="lazy" />
        ) : (
          <div className="wf-card-media-fallback" aria-hidden>
            <span>{WIN_CATEGORY_LABELS[win.category] || "Win"}</span>
          </div>
        )}

        <div className="wf-card-badges">
          {win.isElite ? <span className="wf-badge wf-badge--elite">💎 Elite Win</span> : null}
          {win.isHot && !win.isElite ? (
            <span className="wf-badge wf-badge--hot">🔥 Hot Deal</span>
          ) : null}
          {win.isFastSnipe ? (
            <span className="wf-badge wf-badge--snipe">⚡ {win.secondsToWin}s Snipe</span>
          ) : null}
        </div>

        <div className="wf-card-savings">
          <small>Saved</small>
          <strong>${formatMoney(savings)}</strong>
          {savingsPct != null ? <span>{savingsPct}% off</span> : null}
        </div>
      </div>

      <div className="wf-card-body">
        <h3 className="wf-card-title">{win.title}</h3>
        <div className="wf-card-meta">
          <span className={`wf-verify ${v.cls}`} title={v.label}>
            <span aria-hidden>{v.icon}</span> {v.label}
          </span>
          <span className="wf-card-trust" title="Trust score at time of purchase">
            Trust {Math.round(Number(win.trustScore) || 0)}
          </span>
          <span className="wf-card-cat">
            {WIN_CATEGORY_LABELS[win.category] || win.category}
          </span>
        </div>

        <div className="wf-card-footer">
          <div className="wf-card-author">
            <span
              className="wf-avatar"
              aria-hidden
              style={emblem?.accent ? { background: emblem.accent } : undefined}
              title={emblem?.name}
            >
              {emblem?.glyph || String(win.username || "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>@{win.username || "anon"}</strong>
              <small>
                {formatRelative(win.createdAt)}
              </small>
            </div>
          </div>
          <div className="wf-author-card-wrap">
            <CallingCard
              title={callingCard?.displayTitle || callingCard?.name || "Final10"}
              subtitle={callingCard?.displaySubtitle || callingCard?.tagline || "Operator"}
              rarity={callingCard?.rarity || "common"}
              isUnlocked
              isEquipped={false}
              stripe={callingCard?.stripe}
              flare={callingCard?.flare}
              animationPreset={callingCard?.animationPreset}
              symbol={callingCard?.animationPreset === "first_responder" ? "S★" : ""}
              collection={callingCard?.collection}
              className="wf-author-card"
              showEquippedBadge={false}
            />
          </div>
          {win.source === "external" ? (
            <span className="wf-source-tag" title="Imported via hashtag feed">
              external
            </span>
          ) : null}
        </div>

        {Array.isArray(win.tags) && win.tags.length > 0 ? (
          <div className="wf-card-tags">
            {win.tags.map((t) => (
              <span key={t} className="wf-tag">{t}</span>
            ))}
          </div>
        ) : null}

        {win.pointsAwarded ? (
          <div className="wf-card-reward">
            +{win.pointsAwarded} pts earned
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WinFeed() {
  const { user } = useAuth();
  const [wins, setWins] = useState(() => listWins());
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [todayCount, setTodayCount] = useState(() =>
    readTodaySubmissionCount(user?.username || user?.firstName)
  );

  const defaultUsername =
    user?.username || user?.firstName || (user?.email ? user.email.split("@")[0] : "SavvyUser");

  const refresh = useCallback(() => {
    setWins(listWins());
    setTodayCount(readTodaySubmissionCount(defaultUsername));
  }, [defaultUsername]);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener("f10-win-feed-updated", onUpdate);
    return () => window.removeEventListener("f10-win-feed-updated", onUpdate);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const highlights = useMemo(() => computeWeeklyHighlights(wins), [wins]);
  const stats = useMemo(() => computeFeedStats(wins), [wins]);

  const filtered = useMemo(() => {
    const base = filterAndSort(wins, filter);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((w) => {
      const hay = `${w.title} ${w.username} ${w.category} ${(w.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [wins, filter, search]);

  const handleSubmit = useCallback(
    (payload) => {
      try {
        const tags = normalizeTags(payload.tags);
        submitWin(
          { ...payload, tags, username: defaultUsername },
          { user }
        );
        recordScoutMissionAction("post_win", { pathname: "/win-feed" });
        if (tags.some((t) => String(t).toLowerCase().includes("savvywin"))) {
          recordScoutMissionAction("share_win_proof", { pathname: "/win-feed" });
        }
        refresh();
      } catch (err) {
        if (err instanceof WinSubmissionError) throw err;
        throw new WinSubmissionError("unknown", err?.message || "Submission failed.");
      }
    },
    [defaultUsername, refresh, user]
  );

  return (
    <div className="wf-page">
      <header className="wf-hero">
        <div className="wf-hero-copy">
          <div className="wf-hero-eyebrow">Savvy Wins</div>
          <h1>
            Real wins. Real savings.
            <span className="wf-hero-accent"> Get featured.</span>
          </h1>
          <p>
            The feed below is powered by actual Final10 users. Post your own and you'll
            earn Savvy points, climb the leaderboard, and get front-row placement when
            your save is huge.
          </p>
          <div className="wf-hero-actions">
            <button
              type="button"
              className="wf-btn wf-btn--primary wf-btn--lg"
              onClick={() => setModalOpen(true)}
            >
              <span aria-hidden>🏆</span> Post your win
            </button>
            <div className="wf-hero-chips">
              <span>+100 base pts</span>
              <span>+75 if verified</span>
              <span>+100 on $500+ saves</span>
            </div>
          </div>
        </div>

        <dl className="wf-stats" aria-label="This week in Savvy Wins">
          <div>
            <dt>Wins this week</dt>
            <dd>{stats.totalWins}</dd>
          </div>
          <div>
            <dt>Saved together</dt>
            <dd>${formatMoney(stats.totalSavings)}</dd>
          </div>
          <div>
            <dt>Verified</dt>
            <dd>{stats.verifiedCount}</dd>
          </div>
        </dl>
      </header>

      <section className="wf-highlights" aria-label="Weekly highlights">
        <HighlightCard
          label="Weekly Top Winner"
          icon="👑"
          tone="gold"
          primary={highlights.weeklyTop?.username ? `@${highlights.weeklyTop.username}` : "—"}
          secondary={
            highlights.weeklyTop
              ? `${highlights.weeklyTop.wins} wins · $${formatMoney(highlights.weeklyTop.totalSavings)} saved`
              : "Be the first to stack wins this week"
          }
        />
        <HighlightCard
          label="Biggest Save"
          icon="💎"
          tone="violet"
          primary={
            highlights.biggestSave
              ? `$${formatMoney(highlights.biggestSave.savings)}`
              : "—"
          }
          secondary={
            highlights.biggestSave
              ? `${highlights.biggestSave.title} · @${highlights.biggestSave.username}`
              : "Log a win to take this spot"
          }
        />
        <HighlightCard
          label="Fastest Snipe"
          icon="⚡"
          tone="cyan"
          primary={
            highlights.fastestSnipe?.secondsToWin
              ? `${highlights.fastestSnipe.secondsToWin}s`
              : "—"
          }
          secondary={
            highlights.fastestSnipe
              ? `${highlights.fastestSnipe.title} · @${highlights.fastestSnipe.username}`
              : "Sniper slot open"
          }
        />
      </section>

      <section className="wf-social-banner" aria-label="Final10 social follow">
        <div className="wf-social-banner-copy">
          <h3>Follow Final10 for hidden codes, product wins, trailer teasers, and social-only drops.</h3>
          <p>Some code drops and easter eggs appear on socials first.</p>
        </div>
      </section>

      <Final10SocialLinks
        variant="full"
        className="wf-social-panel"
        title="Follow Final10"
        subtitle="Catch code drops, trailer rewards, teasers, wins, and social-only surprises."
        compactCopy="Some code drops and easter eggs appear on socials first."
      />

      <div className="wf-toolbar">
        <div className="wf-filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`wf-filter ${filter === f.id ? "is-on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="wf-search" aria-label="Search wins">
          <span aria-hidden>🔎</span>
          <input
            type="text"
            placeholder="Search title, tag, or @user"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="wf-empty">
          <h3>No wins match that filter yet.</h3>
          <p>Try a different tab or be the first to post a win in this category.</p>
          <button
            type="button"
            className="wf-btn wf-btn--primary"
            onClick={() => setModalOpen(true)}
          >
            Post your win
          </button>
        </div>
      ) : (
        <div className="wf-grid">
          {filtered.map((w) => (
            <WinCard key={w.id} win={w} />
          ))}
        </div>
      )}

      <PostYourWinModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        defaultUsername={defaultUsername}
        todayCount={todayCount}
      />
    </div>
  );
}

function HighlightCard({ label, icon, tone, primary, secondary }) {
  return (
    <div className={`wf-highlight wf-highlight--${tone}`}>
      <div className="wf-highlight-top">
        <span className="wf-highlight-icon" aria-hidden>{icon}</span>
        <span className="wf-highlight-label">{label}</span>
      </div>
      <div className="wf-highlight-primary">{primary}</div>
      <div className="wf-highlight-secondary">{secondary}</div>
    </div>
  );
}
