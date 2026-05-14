import React from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

/**
 * Profile/settings summary — reads backend GET /api/entitlements/me via useEntitlement.
 */
export default function PremiumEntitlementCard({ entitlement, onRefreshSubscription }) {
  const loading = entitlement?.loading;
  const err = entitlement?.error;
  const isPremium = Boolean(entitlement?.isPremium);
  const status = entitlement?.premiumStatus || "inactive";
  const tier = entitlement?.premiumTier || "free";
  const periodEnd = entitlement?.currentPeriodEnd;
  const trialEnds = entitlement?.trialEndsAt;
  const cancelAtEnd = Boolean(entitlement?.cancelAtPeriodEnd);

  const periodLabel = periodEnd
    ? new Date(periodEnd).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "—";
  const trialLabel = trialEnds ? new Date(trialEnds).toLocaleDateString(undefined, { dateStyle: "medium" }) : null;

  return (
    <section className="f10-profile-card" aria-labelledby="f10-prem-ent-hd">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h2 id="f10-prem-ent-hd" className="f10-profile-card-hd" style={{ marginBottom: 0 }}>
          Subscription
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="f10-profile-refresh"
            disabled={loading}
            onClick={() => onRefreshSubscription?.()}
          >
            {loading ? "…" : "Refresh"}
          </button>
          <Link to="/premium" className="f10-profile-refresh" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Plans
          </Link>
        </div>
      </div>
      {err ? (
        <p style={{ color: "#f87171", marginTop: 10, marginBottom: 0 }}>{err}</p>
      ) : null}
      <div className="f10-profile-stat-grid" style={{ marginTop: 12 }}>
        <div>
          <p className="f10-profile-stat-label">Plan</p>
          <p className="f10-profile-stat-value" style={{ fontSize: "0.95rem" }}>
            {isPremium ? tier : "Free"}
          </p>
        </div>
        <div>
          <p className="f10-profile-stat-label">Status</p>
          <p className="f10-profile-stat-value" style={{ fontSize: "0.95rem" }}>
            {status}
          </p>
        </div>
        <div>
          <p className="f10-profile-stat-label">Renews / ends</p>
          <p className="f10-profile-stat-value" style={{ fontSize: "0.95rem" }}>
            {periodLabel}
          </p>
        </div>
        <div>
          <p className="f10-profile-stat-label">Billing</p>
          <p className="f10-profile-stat-value" style={{ fontSize: "0.95rem" }}>
            {cancelAtEnd ? "Cancels at period end" : isPremium ? "Active" : "—"}
          </p>
        </div>
      </div>
      {trialLabel ? (
        <p className="f10-profile-stat-label" style={{ marginTop: 10, marginBottom: 0 }}>
          Trial ends {trialLabel}
        </p>
      ) : null}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          className="f10-profile-refresh"
          onClick={async () => {
            try {
              const { data } = await api.post("/payments/billing-portal", {});
              if (data?.url) window.location.assign(data.url);
            } catch {
              /* user may not have Stripe customer yet */
            }
          }}
        >
          Manage subscription
        </button>
      </div>
      <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: 10, marginBottom: 0 }}>
        Premium access is determined by your live subscription record — refresh after checkout.
      </p>
    </section>
  );
}
