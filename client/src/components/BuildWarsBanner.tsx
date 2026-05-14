import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBuildWarsConfig } from "../lib/api";

export default function BuildWarsBanner() {
  const [cfg, setCfg] = useState<{
    name?: string;
    endsAt?: string;
    started?: boolean;
    ended?: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getBuildWarsConfig();
        if (!cancelled) setCfg(c);
      } catch {
        if (!cancelled) setCfg(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cfg?.name) return null;

  const end = cfg.endsAt ? new Date(cfg.endsAt).getTime() : 0;
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);

  return (
    <div className="mb-6 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-950/80 to-rose-950/60 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-orange-200/90">Live event</div>
          <div className="text-lg font-black text-white">{cfg.name}</div>
          <div className="text-sm text-orange-100/90">
            {cfg.ended ? "Season ended — claim rank rewards & share your build." : `Ends in ~${d}d ${h}h`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/build-wars"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-orange-950 hover:bg-orange-50"
          >
            Enter / Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
