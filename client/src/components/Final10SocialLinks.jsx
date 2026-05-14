import React from "react";
import { FINAL10_SOCIAL_LIST } from "../config/final10Socials";
import { trackSocialClick } from "../lib/socialAnalytics";
import "../styles/Final10SocialLinks.css";

const ICONS = {
  instagram: "📸",
  facebook: "📘",
  x: "✖",
  tiktok: "🎵",
};

export default function Final10SocialLinks({
  variant = "full",
  title = "Official Final10 Socials",
  subtitle = "",
  compactCopy = "",
  className = "",
}) {
  const isCompact = variant === "compact";

  return (
    <section className={`f10-social ${isCompact ? "is-compact" : "is-full"} ${className}`.trim()}>
      <div className="f10-social-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
        {compactCopy ? <small>{compactCopy}</small> : null}
      </div>

      <div className="f10-social-grid">
        {FINAL10_SOCIAL_LIST.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open Final10 ${s.label} in a new tab`}
            className={`f10-social-link f10-social-link--${s.id}`}
            onClick={() => trackSocialClick(s.id, { surface: className || "global" })}
          >
            <span aria-hidden>{ICONS[s.id] || "🔗"}</span>
            <span>{isCompact ? s.label : s.shortCta}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

