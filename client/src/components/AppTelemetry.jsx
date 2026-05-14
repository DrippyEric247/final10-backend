import { useEffect } from "react";
import { initCrashReporting } from "../lib/crashReporting";
import { initThirdPartyAnalytics } from "../lib/analytics";

/**
 * One-shot bootstrap: crash handlers + optional GA4 script.
 */
export default function AppTelemetry() {
  useEffect(() => {
    initCrashReporting();
    initThirdPartyAnalytics();
  }, []);
  return null;
}
