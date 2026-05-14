import React from "react";
import { Link } from "react-router-dom";
import "../../styles/SocialControls.css";

type RecommendedByCreatorTagProps = {
  /** Handle/username of the recommending creator (without @). */
  creatorHandle: string | null | undefined;
  /** Optional override label, e.g. "Pinned by". Defaults to "Recommended by". */
  prefix?: string;
  /** Compact rendering (used inside dense listing cards). */
  compact?: boolean;
};

/**
 * Listing surface tag that surfaces creator-curated context.
 * Render alongside listing cards inside a creator-curated section.
 */
export default function RecommendedByCreatorTag({
  creatorHandle,
  prefix = "Recommended by",
  compact = false,
}: RecommendedByCreatorTagProps) {
  if (!creatorHandle) return null;
  const handle = String(creatorHandle).replace(/^@/, "");
  return (
    <Link
      to={`/c/${encodeURIComponent(handle)}`}
      className={`recommended-by-tag ${compact ? "recommended-by-tag--compact" : ""}`}
      title={`${prefix} @${handle}`}
    >
      <span className="recommended-by-tag-icon" aria-hidden>
        ✨
      </span>
      <span className="recommended-by-tag-text">
        {prefix} <strong>@{handle}</strong>
      </span>
    </Link>
  );
}
