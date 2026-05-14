import React from "react";
import SavvyMark from "../SavvyMark";
import defaultProductLogo from "../../assets/final10-product-logo.png";

export function ProductIntro({
  appName = "Final10",
  logoSrc = defaultProductLogo,
}: {
  appName?: string;
  logoSrc?: string;
}) {
  return (
    <div className="startup-boot__stage startup-boot__stage--product" aria-hidden>
      <div className="startup-boot__content startup-boot__content--product">
        <SavvyMark variant="product" appName={appName} size={30} glow />
        <img className="startup-boot__product-logo" src={logoSrc} alt={`${appName} logo`} />
      </div>
      <div className="startup-boot__pulse-ring" />
    </div>
  );
}

