import { useEffect, useMemo, useState } from "react";
import { SavvyUniverseIntro } from "./SavvyUniverseIntro";
import { ProductIntro } from "./ProductIntro";
import "../../styles/StartupBootSequence.css";

export const STARTUP_BOOT_SESSION_KEY = "f10_startup_boot_seen";

type BootStage = "savvy" | "product" | "done";

type BootCue =
  | "boot_start"
  | "stage_savvy_start"
  | "stage_product_start"
  | "boot_complete";

export function shouldShowStartupBootSequence() {
  if (typeof window === "undefined") return false;
  const alwaysShow = process.env.REACT_APP_STARTUP_ALWAYS_SHOW === "1";
  if (alwaysShow) return true;
  try {
    return sessionStorage.getItem(STARTUP_BOOT_SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export default function StartupBootSequence({
  appName = "Final10",
  durationMs = 1450,
  onComplete,
  onCue,
}: {
  appName?: string;
  durationMs?: number;
  onComplete?: () => void;
  onCue?: (cue: BootCue) => void;
}) {
  const [stage, setStage] = useState<BootStage>("savvy");

  const stage1Ms = useMemo(() => Math.min(900, Math.max(420, Math.round(durationMs * 0.48))), [durationMs]);
  const stage2Ms = useMemo(() => Math.min(900, Math.max(380, durationMs - stage1Ms)), [durationMs, stage1Ms]);

  useEffect(() => {
    onCue?.("boot_start");
    onCue?.("stage_savvy_start");

    const toProduct = window.setTimeout(() => {
      setStage("product");
      onCue?.("stage_product_start");
    }, stage1Ms);

    const toDone = window.setTimeout(() => {
      setStage("done");
      try {
        sessionStorage.setItem(STARTUP_BOOT_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      onCue?.("boot_complete");
      onComplete?.();
    }, stage1Ms + stage2Ms);

    return () => {
      window.clearTimeout(toProduct);
      window.clearTimeout(toDone);
    };
  }, [onComplete, onCue, stage1Ms, stage2Ms]);

  if (stage === "done") return null;

  return (
    <div className={`startup-boot startup-boot--${stage}`} role="presentation">
      {stage === "savvy" ? <SavvyUniverseIntro /> : <ProductIntro appName={appName} />}
    </div>
  );
}

