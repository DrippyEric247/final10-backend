import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { formatActivityTimestamp, sortActivitiesByRecency } from "../../lib/profileActivityUtils.js";
import { ActivityFeedItem } from "./ActivityFeedItem.jsx";
import "./profileActivity.css";

export function ProfileRecentActivity({
  items,
  limit = 6,
  interactiveRows = true,
  emptyMessage = "No recent moves yet — your next win shows up here.",
}) {
  const sorted = useMemo(() => sortActivitiesByRecency(items).slice(0, limit), [items, limit]);
  const now = Date.now();

  return (
    <motion.section
      className="f10-pa-section"
      aria-labelledby="f10-pa-recent-hd"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="f10-pa-section-inner">
        <h2 id="f10-pa-recent-hd" className="f10-pa-hd">
          Recent activity
        </h2>
        {sorted.length === 0 ? (
          <p className="f10-pa-empty">{emptyMessage}</p>
        ) : (
          <div className="f10-pa-feed" role="list">
            {sorted.map((item) => (
              <ActivityFeedItem
                key={item.id}
                item={item}
                formattedTime={formatActivityTimestamp(item.timestampMs, now)}
                interactive={interactiveRows}
                onPress={
                  interactiveRows
                    ? () => {
                        if (typeof console !== "undefined" && console.info) {
                          console.info("[Activity]", item.id, item.type);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
