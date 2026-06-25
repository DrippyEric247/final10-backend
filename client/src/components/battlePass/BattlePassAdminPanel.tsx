import { useEffect, useState } from "react";
import {
  checkBattlePassAdminAccess,
  adminBattlePassSetTier,
  adminBattlePassGrantXp,
  adminBattlePassResetClaims,
  adminBattlePassForceClaim,
} from "../../lib/api";

export default function BattlePassAdminPanel({ onAfterAction }: { onAfterAction?: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [tierInput, setTierInput] = useState(10);

  useEffect(() => {
    let alive = true;
    void checkBattlePassAdminAccess().then((ok) => {
      if (alive) setIsAdmin(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isAdmin) return null;

  async function run(key: string, fn: () => Promise<unknown>, okNote: string) {
    setBusy(key);
    setError("");
    setNote("");
    try {
      await fn();
      setNote(okNote);
      if (onAfterAction) onAfterAction();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || "Admin action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="f10-bp2-admin" aria-labelledby="bp-admin-heading">
      <div className="f10-bp2-admin-label">Admin Testing</div>
      <h2 id="bp-admin-heading" className="f10-bp2-admin-title">
        Battle Pass Test Controls
      </h2>
      {error ? (
        <div className="f10-bp2-error" role="alert">
          {error}
        </div>
      ) : null}
      {note ? <div className="f10-bp2-admin-note">{note}</div> : null}

      <div className="f10-bp2-admin-row">
        <label className="f10-bp2-admin-field">
          Set tier
          <input
            type="number"
            min={0}
            max={25}
            value={tierInput}
            onChange={(e) => setTierInput(Math.max(0, Math.min(25, Number(e.target.value) || 0)))}
          />
        </label>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run("set-tier", () => adminBattlePassSetTier(tierInput), `Set to tier ${tierInput}.`)}
        >
          Apply tier
        </button>
      </div>

      <div className="f10-bp2-admin-actions">
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("grant-xp", () => adminBattlePassGrantXp(1000), "+1000 BP XP granted.")}>
          Grant 1000 BP XP
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("reset", () => adminBattlePassResetClaims(), "Tier claims reset.")}>
          Reset claims
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("force-10", () => adminBattlePassForceClaim(10), "Force-claimed Tier 10.")}>
          Force claim Tier 10
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("force-25", () => adminBattlePassForceClaim(25), "Force-claimed Tier 25.")}>
          Force claim Tier 25
        </button>
      </div>
    </section>
  );
}
