import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAppConfig } from "../../lib/useAppConfig";
import SavvyMark from "../../components/SavvyMark";
import {
  fetchSavvyCoreProofBootstrap,
  activateSavvyCoreProofTestSubject,
  runSavvyCoreProofParity,
  savvyCoreProofAwardSavvy,
  savvyCoreProofAwardXp,
  savvyCoreProofProgressContract,
  savvyCoreProofUnlockCosmetic,
  savvyCoreProofSecurityTests,
  runSavvyCoreProofFull,
} from "../../lib/savvyCoreProofApi";

function StatusBadge({ pass, label }) {
  if (pass == null) return <span className="chip">{label}: —</span>;
  return (
    <span className={`chip ${pass ? "chip--success" : "chip--danger"}`}>
      {label}: {pass ? "PASS" : "FAIL"}
    </span>
  );
}

const PARITY_ENDPOINT = "/api/savvy-core-proof/parity";

function ReadParityResultPanel({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="card space-y-2 border border-red-500/40">
        <h2 className="font-semibold text-red-400">READ PARITY ERROR</h2>
        <div className="text-sm space-y-1">
          <div><strong>HTTP status:</strong> {result.httpStatus ?? "—"}</div>
          <div><strong>Endpoint:</strong> {result.endpoint || PARITY_ENDPOINT}</div>
          <div><strong>Message:</strong> {result.message || "Request failed."}</div>
        </div>
      </div>
    );
  }

  const rows = result.comparison || [];
  const failedRows = rows.filter((row) => row.match === false);

  if (!result.pass && rows.length === 0 && result.message) {
    return (
      <div className="card space-y-2 border border-red-500/40">
        <h2 className="font-semibold text-lg text-red-400">READ PARITY: FAIL</h2>
        <div className="text-sm text-red-300">{result.message}</div>
        {result.code ? <div className="text-xs opacity-70">Code: {result.code}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={`card space-y-3 border ${
        result.pass ? "border-emerald-500/40" : "border-red-500/40"
      }`}
    >
      <h2 className={`font-semibold text-lg ${result.pass ? "text-emerald-400" : "text-red-400"}`}>
        READ PARITY: {result.pass ? "PASS" : "FAIL"}
      </h2>
      <p className="text-sm opacity-80">
        Test subject <code>{result.userId || "—"}</code>
      </p>
      <div className="text-xs opacity-70 space-y-1">
        <div><strong>Savvy Core source:</strong> {result.sources?.savvyCore || "Savvy Core wallet + progression services"}</div>
        <div><strong>Final10 canonical source:</strong> {result.sources?.final10 || "Final10 User + profileXpService"}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="pr-3 pb-2">Field</th>
              <th className="pr-3 pb-2">Savvy Core</th>
              <th className="pr-3 pb-2">Final10 canonical</th>
              <th className="pb-2">Match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.field} className={row.match ? "" : "text-red-300"}>
                <td className="pr-3 py-1">{row.field}</td>
                <td className="pr-3 py-1">{String(row.savvyCore ?? "—")}</td>
                <td className="pr-3 py-1">{String(row.final10 ?? "—")}</td>
                <td className="py-1">{row.match ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.pass && failedRows.length > 0 ? (
        <div className="text-sm text-red-300">
          <strong>Mismatched fields:</strong>{" "}
          {failedRows.map((row) => row.field).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

export default function SavvyCoreProofPage() {
  const { user, loading } = useAuth();
  const { cfg } = useAppConfig();
  const [bootstrap, setBootstrap] = useState(null);
  const [proofRunId, setProofRunId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState({});
  const [parityResult, setParityResult] = useState(null);

  const serverFlags = bootstrap?.flags || {};
  const savvyCoreEnabled = serverFlags.savvyCoreEnabled ?? cfg?.savvyCoreEnabled ?? false;
  const savvyCoreProofEnabled = serverFlags.savvyCoreProofEnabled ?? cfg?.savvyCoreProofEnabled ?? false;
  const externalWritesEnabled =
    serverFlags.externalWritesEnabled ?? cfg?.savvyCoreExternalWritesEnabled ?? false;
  const testSubjectConfigured = Boolean(bootstrap?.testSubject?.configured && bootstrap?.testSubject?.userId);
  const testSubjectNeedsActivation = Boolean(bootstrap?.testSubject?.needsInternalMarker);
  const mutationsEnabled = Boolean(bootstrap?.mutationsEnabled);
  const readsDisabled = !savvyCoreEnabled || !savvyCoreProofEnabled;
  const mutationsDisabled = readsDisabled || !mutationsEnabled;

  const refresh = useCallback(async () => {
    setBusy("refresh");
    setError("");
    try {
      const data = await fetchSavvyCoreProofBootstrap(proofRunId || undefined);
      setBootstrap(data);
      if (data.proofRunId) setProofRunId(data.proofRunId);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load proof bootstrap.");
    } finally {
      setBusy("");
    }
  }, [proofRunId]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const runAction = useCallback(
    async (key, fn) => {
      if (!proofRunId) {
        setError("Start with REFRESH CORE DATA to obtain a proofRunId.");
        return;
      }
      setBusy(key);
      setError("");
      try {
        const result = await fn(proofRunId);
        setResults((prev) => ({ ...prev, [key]: result }));
        await refresh();
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [key]: { pass: false, error: err?.response?.data?.message || err.message },
        }));
        setError(err?.response?.data?.message || err.message || "Action failed.");
      } finally {
        setBusy("");
      }
    },
    [proofRunId, refresh]
  );

  const runParityCheck = useCallback(async () => {
    setBusy("parity");
    setError("");
    setParityResult(null);
    try {
      const result = await runSavvyCoreProofParity();
      setParityResult(result);
      setResults((prev) => ({ ...prev, parity: result }));
    } catch (err) {
      const failure = {
        error: true,
        pass: false,
        httpStatus: err?.response?.status ?? null,
        endpoint: err?.config?.url || PARITY_ENDPOINT,
        message: err?.response?.data?.message || err.message || "Read parity request failed.",
        code: err?.response?.data?.code || null,
      };
      setParityResult(failure);
      setResults((prev) => ({ ...prev, parity: failure }));
    } finally {
      setBusy("");
    }
  }, []);

  const newProofSession = useCallback(async () => {
    setResults({});
    setParityResult(null);
    setBusy("refresh");
    setError("");
    try {
      const data = await fetchSavvyCoreProofBootstrap();
      setBootstrap(data);
      setProofRunId(data.proofRunId || "");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to start new proof session.");
    } finally {
      setBusy("");
    }
  }, []);

  const activateTestSubject = useCallback(async () => {
    setBusy("activate-test-subject");
    setError("");
    try {
      const result = await activateSavvyCoreProofTestSubject();
      if (result.bootstrap) {
        setBootstrap(result.bootstrap);
        if (result.bootstrap.proofRunId) setProofRunId(result.bootstrap.proofRunId);
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to activate proof test subject.");
    } finally {
      setBusy("");
    }
  }, [refresh]);

  const operatorSummary = useMemo(() => {
    const account = bootstrap?.operatorAccount;
    if (!account) return null;
    return {
      userId: account.userId,
      emailMasked: account.emailMasked,
      username: account.username,
      savvy: account.core?.wallet?.balance,
      level: account.core?.progression?.accountLevel,
      prestige: account.core?.progression?.prestige,
      xp: account.core?.progression?.currentXP,
    };
  }, [bootstrap]);

  const testSubjectSummary = useMemo(() => {
    const account = bootstrap?.testSubjectAccount;
    if (!account) return null;
    return {
      userId: account.userId,
      emailMasked: account.emailMasked,
      username: account.username,
      savvy: account.core?.wallet?.balance,
      level: account.core?.progression?.accountLevel,
      prestige: account.core?.progression?.prestige,
      xp: account.core?.progression?.currentXP,
    };
  }, [bootstrap]);

  const summary = testSubjectSummary || operatorSummary;

  if (loading) {
    return (
      <div className="card flex items-center gap-3">
        <SavvyMark variant="brand" size={24} glow animated />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">SAVVY CORE — APP #2 PRODUCTION PROOF</h1>
        <p className="text-sm opacity-80">
          Internal mock App #2 (<strong>SavvyTrip Test</strong>). Browser → proof backend → Savvy Core.
          No app secrets in this page.
        </p>
        <Link to="/admin" className="text-sm underline opacity-70">
          ← Admin hub
        </Link>
      </div>

      <div className="card space-y-2 text-sm">
        <div><strong>OPERATOR:</strong> {bootstrap?.operator?.emailMasked || "—"} ({bootstrap?.operator?.userId || "—"})</div>
        <div>
          <strong>TEST SUBJECT:</strong>{" "}
          {testSubjectConfigured
            ? `${bootstrap?.testSubject?.emailMasked || "—"} (${bootstrap?.testSubject?.userId})`
            : testSubjectNeedsActivation
              ? `${bootstrap?.testSubject?.emailMasked || bootstrap?.testSubject?.configuredEmailMasked || "—"} (${bootstrap?.testSubject?.userId || "pending activation"})`
              : bootstrap?.testSubject?.configuredEmailMasked || "not configured"}
        </div>
        <div><strong>PROOF TARGET:</strong> TEST SUBJECT ONLY</div>
        {!testSubjectConfigured ? (
          <p className="text-amber-400">
            TEST SUBJECT NOT CONFIGURED — MUTATIONS DISABLED
            {bootstrap?.mutationsBlockReason ? ` (${bootstrap.mutationsBlockReason})` : ""}
          </p>
        ) : null}
        {testSubjectNeedsActivation ? (
          <div className="space-y-2">
            <p className="text-amber-400 text-sm">
              Configured test account exists but is not marked internal/test yet. Activate it as the proof subject only — no admin role is granted.
            </p>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={activateTestSubject}>
              ACTIVATE CONFIGURED TEST SUBJECT
            </button>
            <p className="text-xs opacity-70">
              Alternative: Admin Hub → Founder control → search user → Grant → Enable Founding Tester (sets betaTester + foundingAccess).
            </p>
          </div>
        ) : null}
        {testSubjectConfigured && !mutationsEnabled && bootstrap?.mutationsBlockReason ? (
          <p className="text-amber-400">{bootstrap.mutationsBlockReason}</p>
        ) : null}
        <div><strong>CONNECTED APP:</strong> SavvyTrip Test ({bootstrap?.appId || "savvytrip_test"})</div>
        <div><strong>SAVVY CORE:</strong> {bootstrap?.savvyCoreVersion || "—"}</div>
        <div><strong>DEPLOY SHA:</strong> <code>{bootstrap?.deploymentSha || "—"}</code></div>
        <div><strong>PROOF RUN ID:</strong> <code>{proofRunId || "—"}</code></div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="chip">SAVVY_CORE_V1_ENABLED: {String(savvyCoreEnabled)}</span>
          <span className="chip">EXTERNAL_WRITES: {String(externalWritesEnabled)}</span>
          <span className="chip">PROOF: {String(savvyCoreProofEnabled)}</span>
        </div>
        {readsDisabled ? (
          <p className="text-amber-400 text-sm">
            Proof reads/writes disabled — set SAVVY_CORE_V1_ENABLED=true and SAVVY_CORE_PROOF_ENABLED=true on the server.
          </p>
        ) : null}
      </div>

      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold">Operator account (unchanged by proof mutations)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><strong>SAVVY BALANCE</strong><div>{operatorSummary?.savvy ?? "—"}</div></div>
          <div><strong>ACCOUNT LEVEL</strong><div>{operatorSummary?.level ?? "—"}</div></div>
          <div><strong>PRESTIGE</strong><div>{operatorSummary?.prestige ?? "—"}</div></div>
          <div><strong>ACCOUNT XP</strong><div>{operatorSummary?.xp ?? "—"}</div></div>
        </div>
      </div>

      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold">Test subject account (proof mutations apply here)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><strong>SAVVY BALANCE</strong><div>{testSubjectSummary?.savvy ?? summary?.savvy ?? "—"}</div></div>
          <div><strong>ACCOUNT LEVEL</strong><div>{testSubjectSummary?.level ?? summary?.level ?? "—"}</div></div>
          <div><strong>PRESTIGE</strong><div>{testSubjectSummary?.prestige ?? summary?.prestige ?? "—"}</div></div>
          <div><strong>ACCOUNT XP</strong><div>{testSubjectSummary?.xp ?? summary?.xp ?? "—"}</div></div>
        </div>
      </div>

      {error ? <div className="card text-red-400 text-sm">{error}</div> : null}

      <div className="card flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={refresh}>
          REFRESH CORE DATA
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={newProofSession}>
          NEW PROOF SESSION
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || readsDisabled || !testSubjectConfigured}
          onClick={runParityCheck}
        >
          RUN READ PARITY CHECK
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("savvy50", (id) => savvyCoreProofAwardSavvy(id))}
        >
          AWARD +50 SAVVY
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("idempotency", (id) => savvyCoreProofAwardSavvy(id, { retry: true }))}
        >
          RETRY LAST IDEMPOTENCY KEY
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("xp25", (id) => savvyCoreProofAwardXp(id))}
        >
          AWARD +25 XP
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("contract", (id) => savvyCoreProofProgressContract(id))}
        >
          PROGRESS TEST CONTRACT
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("cosmetic", (id) => savvyCoreProofUnlockCosmetic(id))}
        >
          UNLOCK TEST CALLING CARD
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || mutationsDisabled}
          onClick={() => runAction("security", () => savvyCoreProofSecurityTests())}
        >
          RUN SECURITY NEGATIVE TESTS
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || mutationsDisabled}
          onClick={async () => {
            setBusy("full");
            setError("");
            try {
              const result = await runSavvyCoreProofFull(proofRunId);
              setResults((prev) => ({ ...prev, full: result }));
            } catch (err) {
              setError(err?.response?.data?.message || err.message);
            } finally {
              setBusy("");
            }
          }}
        >
          RUN FULL PROOF
        </button>
      </div>

      <ReadParityResultPanel result={parityResult} />

      <div className="card space-y-2">
        <h2 className="font-semibold">Results</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge pass={results.parity?.pass} label="READ PARITY" />
          <StatusBadge pass={results.savvy50?.pass} label="+50 SAVVY" />
          <StatusBadge pass={results.savvy50?.final10Sync} label="FINAL10 BALANCE SYNC" />
          <StatusBadge pass={results.idempotency?.pass} label="IDEMPOTENCY" />
          <StatusBadge pass={results.xp25?.pass} label="+25 XP" />
          <StatusBadge pass={results.xp25?.final10Sync} label="FINAL10 XP SYNC" />
          <StatusBadge pass={results.contract?.pass} label="CONTRACT" />
          <StatusBadge pass={results.cosmetic?.pass} label="COSMETIC" />
          <StatusBadge pass={results.ledger?.pass} label="LEDGER" />
          <StatusBadge pass={results.security?.pass} label="SECURITY" />
          <StatusBadge
            pass={results.full?.results ? Object.values(results.full.results).every(Boolean) : null}
            label="FULL RUN"
          />
        </div>
        {results.full?.results ? (
          <pre className="text-xs overflow-auto opacity-80">{JSON.stringify(results.full.results, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}
