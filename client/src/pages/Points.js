import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { claimDailyLogin } from "../lib/api";
import { SAVVY_AUTH_REFRESH_REQUEST } from "../store/savvyStore";

function PointsPage() {
  const { user, refreshProfile } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const savvyBalance = Math.max(0, Math.round(Number(user?.savvyPoints) || 0));

  useEffect(() => {
    void refreshProfile?.();
  }, [refreshProfile]);

  const claimDailyReward = async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await claimDailyLogin();
      const added = Number(data?.added ?? data?.savvyPointsEarned);
      if (Number.isFinite(added) && added > 0) {
        setMessage(data.message || `+${added} Savvy claimed`);
      } else {
        setMessage(data?.message || "Daily reward already claimed today");
      }
      await refreshProfile?.();
      try {
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setMessage(err?.response?.data?.message || err?.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Savvy Points</h1>

      <p className="text-xl mb-4">
        Your Balance: <span className="font-mono">{savvyBalance}</span>
      </p>

      <button
        type="button"
        onClick={claimDailyReward}
        disabled={busy}
        className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-lg shadow-lg font-semibold disabled:opacity-60"
      >
        {busy ? "Claiming…" : "Claim Daily Reward"}
      </button>

      {message && <p className="mt-4 text-green-400">{message}</p>}
    </div>
  );
}

export default PointsPage;
