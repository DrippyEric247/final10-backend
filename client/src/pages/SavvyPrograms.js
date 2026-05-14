import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CLAIM_LIMITS,
  REWARD_RULES,
  RESPONDER_AGENCIES,
  SAVVY_PROGRAM_UPDATE_EVENT,
  USER_TYPES,
  VERIFICATION_STATUS,
  enrollInProgram,
  getEnrollment,
  getProgramClaimStatus,
  getProgramStats,
  leaveProgram,
  readProgramEvents,
  verifyEnrollment,
} from "../lib/savvyPrograms";
import { FINAL10_DEV_OVERRIDE_EVENT, getDevFeatureTests, isDev } from "../lib/devOverride";
import "../styles/SavvyPrograms.css";

const DOLLAR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatRelative(ts) {
  if (!ts) return "";
  const diff = Date.now() - Number(ts);
  if (diff < 60 * 1000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusPill({ status }) {
  if (!status) return null;
  const map = {
    [VERIFICATION_STATUS.VERIFIED]: { cls: "sp-status--verified", label: "Verified" },
    [VERIFICATION_STATUS.PENDING]: { cls: "sp-status--pending", label: "Pending" },
    [VERIFICATION_STATUS.REJECTED]: { cls: "sp-status--rejected", label: "Rejected" },
  };
  const m = map[status];
  if (!m) return null;
  return <span className={`sp-status ${m.cls}`}>{m.label}</span>;
}

// ---------- forms ----------

function BusinessForm({ onSubmit, pending, error }) {
  const [form, setForm] = useState({
    businessName: "",
    businessEmail: "",
    paymentRef: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    onSubmit({ userType: USER_TYPES.BUSINESS, ...form });
  };
  return (
    <form className="sp-card" onSubmit={submit}>
      <h2>Business Savvy enrollment</h2>
      <p className="sp-card-sub">
        We auto-verify when your business email isn't a personal webmail domain.
        A payment reference (card last-4 or EIN) lets us attribute team purchases.
      </p>
      <div className="sp-form-grid">
        <div className="sp-field">
          <label htmlFor="sp-biz-name">Business name</label>
          <input
            id="sp-biz-name"
            value={form.businessName}
            onChange={set("businessName")}
            placeholder="Acme Co."
            required
          />
        </div>
        <div className="sp-field">
          <label htmlFor="sp-biz-email">Business email</label>
          <input
            id="sp-biz-email"
            type="email"
            value={form.businessEmail}
            onChange={set("businessEmail")}
            placeholder="you@acme.co"
            required
          />
        </div>
        <div className="sp-field">
          <label htmlFor="sp-biz-pay">Payment reference</label>
          <input
            id="sp-biz-pay"
            value={form.paymentRef}
            onChange={set("paymentRef")}
            placeholder="Card last-4 or EIN"
            required
          />
        </div>
      </div>
      {error ? <div className="sp-error">{error}</div> : null}
      <div className="sp-form-actions">
        <button type="submit" className="sp-btn sp-btn--primary" disabled={pending}>
          {pending ? "Submitting…" : "Enroll in Business Savvy"}
        </button>
        <span className="sp-card-sub">
          Earning multiplier after verification: <strong>{REWARD_RULES.businessMultiplier}×</strong>
        </span>
      </div>
    </form>
  );
}

function ResponderForm({ onSubmit, pending, error }) {
  const [form, setForm] = useState({
    agencyId: "",
    agencyName: "",
    documentName: "",
    attestTruth: false,
  });
  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target?.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  const onFile = (e) => {
    const file = e.target.files?.[0];
    setForm((f) => ({ ...f, documentName: file?.name || "" }));
  };
  const submit = (e) => {
    e.preventDefault();
    onSubmit({ userType: USER_TYPES.RESPONDER, ...form });
  };
  return (
    <form className="sp-card" onSubmit={submit}>
      <h2>Responder Savvy enrollment</h2>
      <p className="sp-card-sub">
        Applications are reviewed manually — typically within 24h. Keep your
        department ID or credential handy; staff will reach out if extra docs
        are needed.
      </p>
      <div className="sp-form-grid">
        <div className="sp-field">
          <label htmlFor="sp-rsp-agency">Service type</label>
          <select id="sp-rsp-agency" value={form.agencyId} onChange={set("agencyId")} required>
            <option value="" disabled>
              Pick one…
            </option>
            {RESPONDER_AGENCIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sp-field">
          <label htmlFor="sp-rsp-name">Agency / department</label>
          <input
            id="sp-rsp-name"
            value={form.agencyName}
            onChange={set("agencyName")}
            placeholder="Dallas Fire-Rescue"
            required
          />
        </div>
        <div className="sp-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="sp-rsp-doc">Credential document (optional)</label>
          <input id="sp-rsp-doc" type="file" onChange={onFile} accept="image/*,.pdf" />
          {form.documentName ? (
            <small style={{ color: "#9fb0d3" }}>{form.documentName}</small>
          ) : null}
        </div>
      </div>
      <label className="sp-field-inline">
        <input type="checkbox" checked={form.attestTruth} onChange={set("attestTruth")} />
        <span>
          I confirm the information above is accurate. Submitting false credentials
          forfeits any earned Responder Savvy rewards.
        </span>
      </label>
      {error ? <div className="sp-error">{error}</div> : null}
      <div className="sp-form-actions">
        <button type="submit" className="sp-btn sp-btn--primary" disabled={pending}>
          {pending ? "Submitting…" : "Apply for Responder Savvy"}
        </button>
        <span className="sp-card-sub">
          Earning multiplier after verification: <strong>{REWARD_RULES.responderMultiplier}×</strong>
        </span>
      </div>
    </form>
  );
}

// ---------- dashboard ----------

function ProgramDashboard({ enrollment, stats, claimStatus, events, onVerify, onLeave }) {
  const isBusiness = enrollment.userType === USER_TYPES.BUSINESS;
  const isResponder = enrollment.userType === USER_TYPES.RESPONDER;
  const multiplier = isBusiness
    ? REWARD_RULES.businessMultiplier
    : isResponder
    ? REWARD_RULES.responderMultiplier
    : 1;
  const isVerified = enrollment.verificationStatus === VERIFICATION_STATUS.VERIFIED;

  const label = isBusiness ? "Business Savvy" : "Responder Savvy";
  const usedPct = Math.round(
    (Number(claimStatus.dailyUsed) / Math.max(1, Number(claimStatus.dailyCap))) * 100
  );

  return (
    <>
      <section className="sp-card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2>{label} · {isVerified ? "Active" : "Pending review"}</h2>
            <p className="sp-card-sub">
              Multiplier: <strong>{isVerified ? `${multiplier}×` : "1× (base until verified)"}</strong>{" "}
              · Enrolled {formatRelative(enrollment.enrolledAt)}
              {isVerified ? <> · Verified {formatRelative(enrollment.verifiedAt)}</> : null}
            </p>
            {isBusiness && enrollment.meta?.businessName ? (
              <p className="sp-card-sub">
                {enrollment.meta.businessName} · {enrollment.meta.domain}
              </p>
            ) : null}
            {isResponder && enrollment.meta?.agencyName ? (
              <p className="sp-card-sub">
                {enrollment.meta.agencyName} ·{" "}
                {RESPONDER_AGENCIES.find((a) => a.id === enrollment.meta.agencyId)?.label ||
                  enrollment.meta.agencyId}
              </p>
            ) : null}
          </div>
          <StatusPill status={enrollment.verificationStatus} />
        </div>
        <div className="sp-form-actions">
          {!isVerified ? (
            <button type="button" className="sp-btn sp-btn--ghost" onClick={onVerify}>
              Mark verified (admin)
            </button>
          ) : null}
          <button type="button" className="sp-btn sp-btn--danger" onClick={onLeave}>
            Leave program
          </button>
          <Link to="/savvy-offers" className="sp-btn">
            Browse curated offers →
          </Link>
        </div>
      </section>

      <section className="sp-card">
        <h2>{isBusiness ? "Business dashboard" : "Responder dashboard"}</h2>
        <div className="sp-stat-grid">
          <div className="sp-stat">
            <p className="sp-stat-label">Total spend</p>
            <p className="sp-stat-value">{DOLLAR.format(stats.totalSpend)}</p>
          </div>
          <div className="sp-stat">
            <p className="sp-stat-label">Savvy earned</p>
            <p className="sp-stat-value">{Number(stats.totalSavvyEarned).toLocaleString()}</p>
          </div>
          <div className="sp-stat">
            <p className="sp-stat-label">Claims</p>
            <p className="sp-stat-value">{stats.totalClaims}</p>
          </div>
          <div className="sp-stat">
            <p className="sp-stat-label">Daily limit</p>
            <p className="sp-stat-value">
              {claimStatus.dailyUsed}/{claimStatus.dailyCap}
            </p>
            <div className="sp-meter" aria-hidden style={{ marginTop: 6 }}>
              <div className="sp-meter-fill" style={{ width: `${Math.min(100, usedPct)}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="sp-card">
        <h2>Top categories</h2>
        {stats.topCategories.length === 0 ? (
          <p className="sp-empty">Claim an offer to light this up.</p>
        ) : (
          <ul className="sp-list">
            {stats.topCategories.map((c) => (
              <li key={c.category} className="sp-list-row">
                <div>
                  <strong style={{ textTransform: "capitalize" }}>{c.category}</strong>
                  <div>
                    <small>
                      {c.count} claim{c.count === 1 ? "" : "s"}
                    </small>
                  </div>
                </div>
                <div className="sp-list-row-right">
                  <strong>{DOLLAR.format(c.spend)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sp-card">
        <h2>Recent offers used</h2>
        {stats.recentOffersUsed.length === 0 ? (
          <p className="sp-empty">Nothing yet — your claim history will appear here.</p>
        ) : (
          <ul className="sp-list">
            {stats.recentOffersUsed.map((row) => (
              <li key={`${row.offerId}-${row.at}`} className="sp-list-row">
                <div>
                  <strong>{row.title || row.offerId || "Offer"}</strong>
                  <div>
                    <small>
                      {row.category || "other"} · {formatRelative(row.at)}
                      {row.trustScore ? ` · trust ${Math.round(row.trustScore)}` : ""}
                    </small>
                  </div>
                </div>
                <div className="sp-list-row-right">
                  <strong>+{Math.round(Number(row.pointsAwarded) || 0).toLocaleString()} Savvy</strong>
                  <div>
                    <small>{DOLLAR.format(row.orderValue || 0)}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sp-card">
        <h2>Recent activity</h2>
        {events.length === 0 ? (
          <p className="sp-empty">Click or claim an eligible offer to start the log.</p>
        ) : (
          <ul className="sp-list">
            {events.slice(0, 8).map((e, i) => (
              <li key={`${e.at}-${i}`} className="sp-list-row">
                <div>
                  <strong style={{ textTransform: "capitalize" }}>{e.eventType}</strong>
                  <div>
                    <small>
                      {e.offerId || "—"} · {formatRelative(e.at)}
                    </small>
                  </div>
                </div>
                <div className="sp-list-row-right">
                  <small>
                    {e.category || "—"}
                    {e.orderValue ? ` · ${DOLLAR.format(e.orderValue)}` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------- page ----------

export default function SavvyPrograms() {
  const [enrollment, setEnrollment] = useState(() => getEnrollment());
  const [devOvTick, setDevOvTick] = useState(0);
  const [pickedType, setPickedType] = useState(USER_TYPES.BUSINESS);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [stats, setStats] = useState(() => getProgramStats());
  const [claimStatus, setClaimStatus] = useState(() => getProgramClaimStatus());
  const [events, setEvents] = useState(() => readProgramEvents(12));

  const refreshAll = useCallback(() => {
    setEnrollment(getEnrollment());
    setStats(getProgramStats());
    setClaimStatus(getProgramClaimStatus());
    setEvents(readProgramEvents(12));
  }, []);

  useEffect(() => {
    window.addEventListener(SAVVY_PROGRAM_UPDATE_EVENT, refreshAll);
    window.addEventListener("storage", refreshAll);
    return () => {
      window.removeEventListener(SAVVY_PROGRAM_UPDATE_EVENT, refreshAll);
      window.removeEventListener("storage", refreshAll);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!isDev) return undefined;
    const bump = () => setDevOvTick((n) => n + 1);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
    return () => window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
  }, []);

  const enrollmentEffective = useMemo(() => {
    void devOvTick;
    const preview = isDev && getDevFeatureTests().savvyPrograms;
    if (!preview) return enrollment;
    return {
      ...enrollment,
      userType: USER_TYPES.BUSINESS,
      verificationStatus: VERIFICATION_STATUS.VERIFIED,
      enrolledAt: enrollment.enrolledAt || Date.now(),
      verifiedAt: enrollment.verifiedAt || Date.now(),
      meta: { ...(enrollment.meta || {}), devPreview: true },
    };
  }, [enrollment, devOvTick]);

  const isEnrolled = enrollmentEffective.userType !== USER_TYPES.CONSUMER;

  const handleEnroll = useCallback(
    (input) => {
      setPending(true);
      setError(null);
      try {
        enrollInProgram(input);
        refreshAll();
      } catch (err) {
        setError(err?.message || "Enrollment failed.");
      } finally {
        setPending(false);
      }
    },
    [refreshAll]
  );

  const handleVerify = useCallback(() => {
    try {
      verifyEnrollment({ verifiedBy: "admin_self_verify" });
      refreshAll();
    } catch (err) {
      setError(err?.message || "Verification failed.");
    }
  }, [refreshAll]);

  const handleLeave = useCallback(() => {
    if (!window.confirm("Leave the program? Your claim history is kept but rewards drop back to 1×.")) {
      return;
    }
    leaveProgram();
    refreshAll();
    setError(null);
  }, [refreshAll]);

  const header = useMemo(
    () => (
      <header className="sp-hero">
        <div>
          <h1>Savvy Programs</h1>
          <p>
            Business and responder teams earn enhanced rewards and see curated,
            high-trust deals. Enroll once, and every eligible purchase pays you
            more — supplies, travel, events.
          </p>
          <p className="sp-tagline">“The smartest way to spend.”</p>
        </div>
        {isEnrolled ? <StatusPill status={enrollmentEffective.verificationStatus} /> : null}
      </header>
    ),
    [isEnrolled, enrollmentEffective.verificationStatus]
  );

  return (
    <div className="sp-root">
      <div className="sp-wrap">
        {header}

        {isEnrolled ? (
          <ProgramDashboard
            enrollment={enrollmentEffective}
            stats={stats}
            claimStatus={claimStatus}
            events={events}
            onVerify={handleVerify}
            onLeave={handleLeave}
          />
        ) : (
          <>
            <section className="sp-select" aria-label="Pick a program">
              <button
                type="button"
                className={`sp-select-card ${
                  pickedType === USER_TYPES.BUSINESS ? "is-active" : ""
                }`}
                onClick={() => setPickedType(USER_TYPES.BUSINESS)}
              >
                <span className="sp-select-glyph" aria-hidden>
                  🏢
                </span>
                <h3>Business Savvy</h3>
                <p>
                  For teams buying supplies, equipment, travel, and events.
                  Auto-verified via your work email and a payment reference.
                </p>
                <span className="sp-select-mult">{REWARD_RULES.businessMultiplier}× Savvy payout</span>
              </button>
              <button
                type="button"
                className={`sp-select-card ${
                  pickedType === USER_TYPES.RESPONDER ? "is-active" : ""
                }`}
                onClick={() => setPickedType(USER_TYPES.RESPONDER)}
              >
                <span className="sp-select-glyph" aria-hidden>
                  🛡️
                </span>
                <h3>Responder Savvy</h3>
                <p>
                  For fire, EMS, police, nurses, military, and educators.
                  Verified manually so the rewards are real where it matters.
                </p>
                <span className="sp-select-mult">{REWARD_RULES.responderMultiplier}× Savvy payout</span>
              </button>
            </section>

            {pickedType === USER_TYPES.BUSINESS ? (
              <BusinessForm onSubmit={handleEnroll} pending={pending} error={error} />
            ) : (
              <ResponderForm onSubmit={handleEnroll} pending={pending} error={error} />
            )}

            <section className="sp-card">
              <h2>What you'll unlock</h2>
              <ul className="sp-list">
                <li className="sp-list-row">
                  <div>
                    <strong>Enhanced rewards</strong>
                    <div>
                      <small>
                        Business {REWARD_RULES.businessMultiplier}× · Responder{" "}
                        {REWARD_RULES.responderMultiplier}× — plus bulk bonuses up to +50% on large
                        orders.
                      </small>
                    </div>
                  </div>
                </li>
                <li className="sp-list-row">
                  <div>
                    <strong>Curated, high-trust feed</strong>
                    <div>
                      <small>
                        Trusted vendors bubble up first, with "Bulk-friendly" and "Best for teams"
                        labels baked in.
                      </small>
                    </div>
                  </div>
                </li>
                <li className="sp-list-row">
                  <div>
                    <strong>Program dashboard</strong>
                    <div>
                      <small>
                        Track total spend, Savvy earned, top categories, and recent offers used.
                      </small>
                    </div>
                  </div>
                </li>
                <li className="sp-list-row">
                  <div>
                    <strong>Safety guardrails</strong>
                    <div>
                      <small>
                        No rewards on low-trust listings. Max{" "}
                        {CLAIM_LIMITS.business}/day (business) ·{" "}
                        {CLAIM_LIMITS.responder}/day (responder). Duplicate claims blocked.
                      </small>
                    </div>
                  </div>
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
