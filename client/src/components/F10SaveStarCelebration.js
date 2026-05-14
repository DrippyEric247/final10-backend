import { createPortal } from "react-dom";
import { motion } from "framer-motion";

const DURATION = 0.76;

/**
 * Full-viewport “gem secured” moment: star scales from click origin with glow, burst, shine.
 * pointer-events-none; mount only while animating.
 */
export default function F10SaveStarCelebration({
  origin,
  message,
  rewardPoints = 15,
  praise = "Good job!",
  powerRewardLabel = "Power",
  momentumHint = null,
  onComplete,
}) {
  const { x, y } = origin;

  return createPortal(
    <div
      className="f10-save-star-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0.22, 0] }}
        transition={{ duration: DURATION, times: [0, 0.2, 0.5, 1], ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(251,191,36,0.25) 0%, rgba(167,139,250,0.08) 40%, transparent 70%)",
        }}
      />

      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.2, opacity: 0.55 }}
          animate={{ scale: 2.8 + i * 0.45, opacity: [0.5, 0.22, 0] }}
          transition={{
            duration: DURATION,
            delay: i * 0.04,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: "min(42vmin, 280px)",
            height: "min(42vmin, 280px)",
            marginLeft: "calc(-1 * min(21vmin, 140px))",
            marginTop: "calc(-1 * min(21vmin, 140px))",
            borderRadius: "50%",
            border: "2px solid rgba(251,191,36,0.45)",
            boxShadow:
              "0 0 40px rgba(251,191,36,0.35), inset 0 0 30px rgba(255,209,102,0.15)",
          }}
        />
      ))}

      {[...Array(10)].map((_, i) => (
        <motion.div
          key={`ray-${i}`}
          initial={{ scaleY: 0.15, opacity: 0 }}
          animate={{ scaleY: [0.2, 1.05, 0.4], opacity: [0, 0.85, 0] }}
          transition={{
            duration: DURATION * 0.92,
            times: [0, 0.35, 1],
            ease: [0.22, 1, 0.36, 1],
            delay: 0.02,
          }}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: 3,
            height: "min(38vmin, 220px)",
            marginLeft: -1.5,
            marginTop: "calc(-1 * min(38vmin, 220px))",
            transformOrigin: "50% 100%",
            transform: `rotate(${i * 36}deg)`,
            background:
              "linear-gradient(to top, transparent 0%, rgba(255,209,102,0.95) 35%, rgba(251,191,36,0.4) 70%, transparent 100%)",
            filter: "blur(0.5px)",
            borderRadius: 2,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(6px, 1.6vmin, 12px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.35, opacity: 0, rotate: -12 }}
          animate={{
            scale: [0.35, 1.12, 1.02, 0.25],
            opacity: [0, 1, 1, 0],
            rotate: [-12, 8, 0, 18],
          }}
          transition={{
            duration: DURATION,
            times: [0, 0.28, 0.52, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          onAnimationComplete={onComplete}
          style={{
            fontSize: "min(52vmin, 14rem)",
            lineHeight: 1,
            filter:
              "drop-shadow(0 0 24px rgba(251,191,36,0.95)) drop-shadow(0 0 60px rgba(255,209,102,0.5)) drop-shadow(0 0 100px rgba(167,139,250,0.35))",
            userSelect: "none",
          }}
        >
          ⭐
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [8, 0, 0, -6],
            scale: [0.9, 1, 1, 0.92],
          }}
          transition={{
            duration: DURATION,
            times: [0, 0.12, 0.55, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            fontSize: "clamp(0.95rem, 3.2vmin, 1.25rem)",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: "linear-gradient(90deg, #fde68a, #fbbf24, #c4b5fd)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 30px rgba(251,191,36,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.65 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [14, -2, -4, -14],
            scale: [0.65, 1.08, 1.02, 0.88],
          }}
          transition={{
            duration: DURATION,
            times: [0, 0.14, 0.5, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontSize: "clamp(1.85rem, 8vmin, 2.85rem)",
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
              color: "#fff",
              textShadow:
                "0 0 28px rgba(251,191,36,0.95), 0 0 56px rgba(52,211,153,0.45), 0 2px 0 rgba(0,0,0,0.35)",
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
          >
            +{rewardPoints} {powerRewardLabel}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.92 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [10, 0, 0, -8],
            scale: [0.92, 1.03, 1, 0.95],
          }}
          transition={{
            duration: DURATION,
            times: [0, 0.18, 0.58, 1],
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            fontSize: "clamp(1rem, 3.8vmin, 1.35rem)",
            fontWeight: 800,
            color: "#a7f3d0",
            textShadow:
              "0 0 20px rgba(52,211,153,0.75), 0 0 40px rgba(167,139,250,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          {praise}
        </motion.div>

        {momentumHint ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [6, 0, 0, -4],
            }}
            transition={{
              duration: DURATION,
              times: [0, 0.12, 0.62, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              marginTop: 4,
              fontSize: "clamp(0.78rem, 2.6vmin, 0.95rem)",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "rgba(253, 186, 116, 0.95)",
              textShadow: "0 0 16px rgba(251, 146, 60, 0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {momentumHint}
          </motion.div>
        ) : null}

        <motion.div
          aria-hidden
          initial={{ x: "-120%", opacity: 0, skewX: -18 }}
          animate={{ x: ["-120%", "140%"], opacity: [0, 0.9, 0.85, 0] }}
          transition={{
            duration: DURATION * 0.85,
            times: [0, 0.25, 0.6, 1],
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            top: "min(22vmin, 5.5rem)",
            width: "min(28vmin, 8rem)",
            height: "min(42vmin, 11rem)",
            background:
              "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.15) 55%, transparent 100%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>,
    document.body
  );
}
