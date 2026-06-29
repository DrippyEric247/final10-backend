import React from "react";
import { Sparkles } from "lucide-react";

/**
 * Unified empty state — use whenever a list / feed / dashboard has no
 * content to show. A clear title + one-line helper + optional primary
 * action keeps the empty surface feeling purposeful instead of broken.
 *
 * Always include a primary action when one makes sense. App Store
 * reviewers flag "dead end" screens that give the user nowhere to go.
 */
/**
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {import('react').ReactNode} [props.icon]
 * @param {import('react').ReactNode} [props.action]
 * @param {string} [props.className]
 */
export default function EmptyState({
  title = "Nothing here yet",
  description,
  icon,
  action,
  className = "",
}) {
  return (
    <div
      role="status"
      className={["f10-state", "f10-state--empty", className].join(" ")}
    >
      <div className="f10-state__icon" aria-hidden>
        {icon || <Sparkles className="h-6 w-6" />}
      </div>
      <h3 className="f10-state__title">{title}</h3>
      {description ? <p className="f10-state__desc">{description}</p> : null}
      {action ? <div className="f10-state__action">{action}</div> : null}
    </div>
  );
}
