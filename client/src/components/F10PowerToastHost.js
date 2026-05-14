import { useEffect, useRef, useState } from "react";
import {
  POWER_TOAST_EVENT,
} from "../lib/final10PowerFeedback";
import "../styles/F10PowerToastHost.css";

/**
 * Listens for +Power toasts; one at a time, short duration, GPU-friendly.
 */
export default function F10PowerToastHost() {
  const [toast, setToast] = useState(null);
  const clearRef = useRef(null);

  useEffect(() => {
    const onToast = (e) => {
      const d = e.detail;
      if (!d || typeof d.points !== "number") return;
      if (clearRef.current) window.clearTimeout(clearRef.current);
      setToast({
        points: d.points,
        praise: typeof d.praise === "string" && d.praise.trim() ? d.praise.trim() : null,
        key: Date.now(),
      });
      clearRef.current = window.setTimeout(() => setToast(null), 2200);
    };
    window.addEventListener(POWER_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(POWER_TOAST_EVENT, onToast);
      if (clearRef.current) window.clearTimeout(clearRef.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className="f10-power-toast-host"
      aria-live="polite"
      aria-atomic="true"
    >
      <div key={toast.key} className="f10-power-toast">
        <span className="f10-power-toast-main">+{toast.points} Power</span>
        {toast.praise ? (
          <span className="f10-power-toast-praise">{toast.praise}</span>
        ) : null}
      </div>
    </div>
  );
}
