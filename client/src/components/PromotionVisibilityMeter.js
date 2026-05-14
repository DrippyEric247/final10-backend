import { useMemo, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* Bursts when crossing these promo counts (matches feed tier beats). */
const MILESTONE_LABELS = [3, 5, 10, 15];

/** 0 = off, 1 = dim…4 = max beam */
function visibilityStage(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

const STAGE = {
  0: {
    bulbBrightness: 0.32,
    glowA: "rgba(251,191,36,0.12)",
    glowB: "rgba(124,131,255,0.06)",
    blur: 18,
    bodyFrom: "#4b5563",
    bodyTo: "#1f2937",
    filament: "rgba(156,163,175,0.35)",
    rayOpacity: 0,
  },
  1: {
    bulbBrightness: 0.55,
    glowA: "rgba(253,224,71,0.35)",
    glowB: "rgba(251,191,36,0.2)",
    blur: 28,
    bodyFrom: "#fde047",
    bodyTo: "#ca8a04",
    filament: "rgba(254,243,199,0.75)",
    rayOpacity: 0.15,
  },
  2: {
    bulbBrightness: 0.78,
    glowA: "rgba(253,224,71,0.55)",
    glowB: "rgba(251,191,36,0.38)",
    blur: 38,
    bodyFrom: "#fef08a",
    bodyTo: "#eab308",
    filament: "rgba(255,255,255,0.9)",
    rayOpacity: 0.28,
  },
  3: {
    bulbBrightness: 0.95,
    glowA: "rgba(254,249,195,0.75)",
    glowB: "rgba(251,191,36,0.5)",
    blur: 48,
    bodyFrom: "#fffbeb",
    bodyTo: "#facc15",
    filament: "#ffffff",
    rayOpacity: 0.42,
  },
  4: {
    bulbBrightness: 1,
    glowA: "rgba(255,255,255,0.9)",
    glowB: "rgba(251,191,36,0.65)",
    blur: 62,
    bodyFrom: "#ffffff",
    bodyTo: "#fde047",
    filament: "#ffffff",
    rayOpacity: 0.55,
  },
};

function taglineFor(count) {
  if (count <= 0) return "More promos = more visibility";
  if (count < 5) return "Your reach is growing";
  if (count < 10) return "Visibility climbing — keep going";
  return "Maximum beam — you're everywhere";
}

export function crossedMilestone(prevCount, nextCount) {
  return MILESTONE_LABELS.some((m) => prevCount < m && nextCount >= m);
}

/**
 * Light-bulb visibility meter: brightness scales with promoted item count.
 * promotePulseKey / milestoneBurstKey increment from parent on add / milestone.
 */
export default function PromotionVisibilityMeter({
  count,
  promotePulseKey = 0,
  milestoneBurstKey = 0,
}) {
  const stage = visibilityStage(count);
  const s = STAGE[stage];
  const label = useMemo(() => taglineFor(count), [count]);
  const prevPulseRef = useRef(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [milestoneTip, setMilestoneTip] = useState("");

  useEffect(() => {
    if (milestoneBurstKey < 1) return;
    setMilestoneTip("Reach milestone — visibility spike!");
    const t = window.setTimeout(() => setMilestoneTip(""), 2200);
    return () => clearTimeout(t);
  }, [milestoneBurstKey]);

  useEffect(() => {
    if (promotePulseKey > prevPulseRef.current) {
      prevPulseRef.current = promotePulseKey;
      setIsPulsing(true);
      const id = window.setTimeout(() => setIsPulsing(false), 480);
      return () => clearTimeout(id);
    }
  }, [promotePulseKey]);

  const baseFilter = `brightness(${s.bulbBrightness}) drop-shadow(0 0 ${8 + stage * 8}px ${s.glowA})`;

  return (
    <div className="promotion-visibility-meter">
      <AnimatePresence mode="sync">
        {milestoneBurstKey > 0 ? (
          <motion.div
            key={`burst-${milestoneBurstKey}`}
            className="promotion-visibility-burst"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.95, 0.35, 0],
              scale: [0.65, 1.12, 1.28],
            }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
      </AnimatePresence>

      <div className="promotion-visibility-meter-inner">
        <div className="promotion-visibility-bulb-wrap">
          {[0, 1].map((layer) => (
            <motion.div
              key={layer}
              className="promotion-visibility-glow-ring"
              animate={{
                opacity: stage === 0 ? 0.22 : 0.5 + layer * 0.22,
                scale: 1 + layer * 0.1,
              }}
              transition={{ type: "spring", stiffness: 140, damping: 20 }}
              style={{
                background: `radial-gradient(circle, ${s.glowA} 0%, ${s.glowB} 45%, transparent 70%)`,
                filter: `blur(${s.blur + layer * 10}px)`,
              }}
            />
          ))}

          {[...Array(8)].map((_, i) => (
            <div
              key={`ray-wrap-${i}`}
              className="promotion-visibility-ray-wrap"
              style={{ transform: `rotate(${i * 45}deg)` }}
            >
              <motion.div
                className="promotion-visibility-ray"
                animate={{
                  opacity: isPulsing ? [s.rayOpacity, 0.75, s.rayOpacity] : s.rayOpacity,
                  scaleY: stage >= 2 ? 1 : 0.55,
                }}
                transition={{
                  duration: isPulsing ? 0.45 : 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
          ))}

          <div className="promotion-visibility-bulb-core">
            <motion.div
              className="promotion-visibility-bulb-swing"
              animate={
                isPulsing
                  ? {
                      filter: [
                        baseFilter,
                        `brightness(${Math.min(1.15, s.bulbBrightness + 0.4)}) drop-shadow(0 0 32px rgba(255,255,255,0.95))`,
                        baseFilter,
                      ],
                      scale: [1, 1.09, 1.02, 1],
                      rotate: [0, -4, 3, 0],
                    }
                  : {
                      filter: baseFilter,
                      scale: 1,
                      rotate: 0,
                    }
              }
              transition={
                isPulsing
                  ? { duration: 0.48, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0.4, ease: "easeOut" }
              }
            >
              <div
                className="promotion-visibility-bulb-glass"
                style={{
                  background: `radial-gradient(ellipse 80% 70% at 50% 32%, ${s.bodyFrom}, ${s.bodyTo} 72%, #451a03)`,
                  boxShadow:
                    "inset 0 -8px 16px rgba(0,0,0,0.35), inset 0 4px 12px rgba(255,255,255,0.22)",
                }}
              >
                <div
                  className="promotion-visibility-filament promotion-visibility-filament--v"
                  style={{
                    background: `linear-gradient(180deg, transparent, ${s.filament}, transparent)`,
                    opacity: stage === 0 ? 0.45 : 1,
                  }}
                />
                <div
                  className="promotion-visibility-filament promotion-visibility-filament--h"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${s.filament}, transparent)`,
                    opacity: stage === 0 ? 0.35 : 0.95,
                  }}
                />
              </div>
              <div className="promotion-visibility-bulb-base" />
            </motion.div>

            <AnimatePresence>
              {isPulsing ? (
                <motion.div
                  key="energy-ring"
                  className="promotion-visibility-energy-ring"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: [0.6, 0.15, 0], scale: [0.75, 1.35, 1.55] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div className="promotion-visibility-copy">
          <div className="promotion-visibility-title">Visibility meter</div>
          <p className="promotion-visibility-tagline">{label}</p>
          <AnimatePresence>
            {milestoneTip ? (
              <motion.p
                key={milestoneBurstKey}
                className="promotion-visibility-milestone-msg"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {milestoneTip}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <div className="promotion-visibility-stage-row">
            <span className="promotion-visibility-count">{count}</span>
            <span className="promotion-visibility-stage-label">
              {stage === 0 && "Off"}
              {stage === 1 && "Soft glow"}
              {stage === 2 && "Bright"}
              {stage === 3 && "Intense"}
              {stage === 4 && "Max beam"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
