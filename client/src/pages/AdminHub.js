import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasAdminRole } from "../lib/adminAccess";
import { ADMIN_TEST_ALERT, fireAdminTestAlert } from "../lib/adminTestAlert";
import SavvyMark from "../components/SavvyMark";

const ADMIN_LINKS = [
  { label: "Cosmetics grants", path: "/admin/cosmetics", description: "Exclusive calling cards and emblems" },
  { label: "SavvyShield", path: "/shield-dashboard", description: "Fraud prevention and enforcement" },
  { label: "Founder control", path: "/owner-control", description: "User search, grants, founding access" },
  { label: "Launch KPIs", path: "/launch-kpis", description: "Growth and funnel metrics" },
  { label: "Growth levers", path: "/growth-levers", description: "Internal growth experiments" },
  { label: "Production readiness", path: "/production-readiness", description: "Launch checklist" },
];

export default function AdminHub() {
  const { user, loading } = useAuth();
  const show = hasAdminRole(user);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState("");

  const runTestAlert = useCallback(async () => {
    setTestBusy(true);
    setTestError("");
    try {
      const result = await fireAdminTestAlert();
      setTestResult(result);
    } catch (err) {
      setTestError(err?.message || "Test alert failed.");
    } finally {
      setTestBusy(false);
    }
  }, []);

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
        <p className="text-gray-400 text-sm">Admin or superadmin role required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-gray-400 text-sm mt-1">
          Operator tools for {user?.email || user?.username || "your account"}.
        </p>
      </header>

      <section className="card border border-amber-400/35 bg-amber-500/5 space-y-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] uppercase text-amber-200">
            Admin Test Alert
          </p>
          <h2 className="text-lg font-bold text-white mt-1">Quick Savvy Scout test</h2>
          <p className="text-sm text-gray-300 mt-1">
            Creates a sample PS5 deal alert and triggers the Savvy Scout deal-found toast +
            animation. Safe for production — clearly labeled as an admin test.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white hover:brightness-105 disabled:opacity-60"
          onClick={() => void runTestAlert()}
          disabled={testBusy}
        >
          {testBusy ? "Creating test alert…" : "Create Test Alert"}
        </button>
        {testError ? (
          <p className="text-sm text-red-300">{testError}</p>
        ) : null}
        {testResult ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-2">
            <p className="text-xs font-black tracking-[0.14em] uppercase text-emerald-200">
              {testResult.usedMock ? "Mock alert (API fallback)" : "Alert saved"}
            </p>
            <p className="text-sm font-bold text-white">{ADMIN_TEST_ALERT.title}</p>
            <p className="text-sm text-gray-200">{ADMIN_TEST_ALERT.message}</p>
            <p className="text-xs text-gray-400">
              Price ${ADMIN_TEST_ALERT.price} · Target ${ADMIN_TEST_ALERT.targetPrice} · Type{" "}
              {ADMIN_TEST_ALERT.type}
            </p>
            <Link
              to={ADMIN_TEST_ALERT.viewDealUrl}
              className="inline-flex rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-violet-500"
            >
              View Deal
            </Link>
          </div>
        ) : null}
      </section>

      <ul className="space-y-3">
        {ADMIN_LINKS.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              className="card block hover:border-purple-500/50 transition-colors"
            >
              <span className="font-semibold">{item.label}</span>
              <span className="block text-sm text-gray-400 mt-1">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
