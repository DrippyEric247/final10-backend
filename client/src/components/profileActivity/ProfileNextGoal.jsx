import React from "react";
import { motion } from "framer-motion";
import { GoalProgressCard } from "./GoalProgressCard.jsx";
import { RewardPreviewCard } from "./RewardPreviewCard.jsx";
import "./profileActivity.css";

export function ProfileNextGoal({
  goal,
  hypeLine = "One more push can change your rank.",
  onCta,
}) {
  return (
    <motion.section
      className="f10-pa-section f10-pa-goal-wrap"
      aria-labelledby="f10-pa-goal-hd"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
    >
      <div className="f10-pa-section-inner">
        <h2 id="f10-pa-goal-hd" className="f10-pa-hd">
          Next goal
        </h2>
        <GoalProgressCard goal={goal} />
        <RewardPreviewCard reward={goal.reward} />
        <button type="button" className="f10-pa-goal-cta" onClick={() => onCta?.(goal.ctaActionId)}>
          {goal.ctaLabel}
        </button>
        <p className="f10-pa-goal-hype">{hypeLine}</p>
      </div>
    </motion.section>
  );
}
