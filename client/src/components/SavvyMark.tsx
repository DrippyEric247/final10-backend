import React, { useMemo, useState } from "react";
import "../styles/SavvyMark.css";

type SavvyMarkVariant = "icon" | "brand" | "product";

type SavvyMarkProps = {
  variant: SavvyMarkVariant;
  appName?: string;
  size?: number;
  glow?: boolean;
  animated?: boolean;
  className?: string;
};

const BRAND_TEXT = "Savvy";
const LOCAL_UPLOAD_LOGO_URI =
  "file:///C:/Users/ericv/.cursor/projects/c-Users-ericv-final10-client-src-pages/assets/c__Users_ericv_AppData_Roaming_Cursor_User_workspaceStorage_1e4c09db96f332e332faf9480177bab5_images_ChatGPT_Image_Apr_27__2026__04_08_18_PM-71effd12-b4d3-4443-9888-60105a103c6c.png";

export default function SavvyMark({
  variant,
  appName = "Final10",
  size = 24,
  glow = false,
  animated = false,
  className = "",
}: SavvyMarkProps) {
  const iconSize = Math.max(14, Number(size) || 24);
  const wordSize = Math.max(14, Math.round(iconSize * 0.86));
  const appSize = Math.max(12, Math.round(iconSize * 0.7));
  const logoCandidates = useMemo(
    () =>
      [
        process.env.REACT_APP_SAVVY_LOGO_URL || "",
        "/savvy-final10-logo.png",
        LOCAL_UPLOAD_LOGO_URI,
      ].filter(Boolean),
    []
  );
  const [logoIndex, setLogoIndex] = useState(0);
  const [showSvgFallback, setShowSvgFallback] = useState(logoCandidates.length === 0);

  const rootClass = [
    "savvy-mark",
    `savvy-mark--${variant}`,
    glow ? "savvy-mark--glow" : "",
    animated ? "savvy-mark--animated" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const svgIcon = (
    <span className="savvy-mark__icon-wrap" style={{ width: iconSize, height: iconSize }} aria-hidden>
      <svg
        className="savvy-mark__icon"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="savvy-loop-gradient" x1="5" y1="8" x2="58" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#67E8F9" />
            <stop offset="0.55" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="29" stroke="rgba(56,189,248,0.24)" strokeWidth="1.6" />
        <path
          d="M47 16C42.4 11.4 35.2 10.8 29.5 13.8C22.7 17.4 19.8 25.6 22.5 31.9C24.8 37.5 31.2 40.3 37.2 38.4C41.9 37 46 32.5 46 27.3C46 22.9 43.3 19 39.1 17.6C35.1 16.2 30.4 17.5 28.1 20.9C25.8 24.3 26.3 28.8 29.2 31.4C31.9 33.9 36.6 34.1 39.1 31.7C40.7 30.2 41 27.8 39.9 26.1"
          stroke="url(#savvy-loop-gradient)"
          strokeWidth="6.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
  const logoSrc = logoCandidates[logoIndex];
  const imageIcon =
    !showSvgFallback && logoSrc ? (
      <span className="savvy-mark__icon-wrap savvy-mark__icon-wrap--image" style={{ width: iconSize, height: iconSize }} aria-hidden>
        <img
          className="savvy-mark__icon-image"
          src={logoSrc}
          alt=""
          width={iconSize}
          height={iconSize}
          onError={() => {
            if (logoIndex < logoCandidates.length - 1) {
              setLogoIndex((prev) => prev + 1);
              return;
            }
            setShowSvgFallback(true);
          }}
        />
      </span>
    ) : null;
  const icon = imageIcon || svgIcon;

  if (variant === "icon") {
    return (
      <span className={rootClass} role="img" aria-label="Savvy mark">
        {icon}
      </span>
    );
  }

  return (
    <span className={rootClass} role="img" aria-label={variant === "brand" ? "Savvy logo" : `Savvy ${appName} logo`}>
      {icon}
      <span className="savvy-mark__word" style={{ fontSize: wordSize }}>
        {BRAND_TEXT}
      </span>
      {variant === "product" ? (
        <span className="savvy-mark__product" style={{ fontSize: appSize }}>
          {appName}
        </span>
      ) : null}
    </span>
  );
}

