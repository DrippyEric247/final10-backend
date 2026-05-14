import React from "react";
import SavvyMark from "../SavvyMark";
import savvyUniverseImage from "../../assets/savvy-universe-intro.png";

export function SavvyUniverseIntro({
  subtitle = "Powering the ecosystem",
}: {
  subtitle?: string;
}) {
  return (
    <div className="startup-boot__stage startup-boot__stage--savvy" aria-hidden>
      <img className="startup-boot__bg-art startup-boot__bg-art--savvy" src={savvyUniverseImage} alt="" />
      <div className="startup-boot__halo" />
      <div className="startup-boot__content">
        <SavvyMark variant="brand" size={36} glow animated />
        <h2 className="startup-boot__title">Savvy Universe</h2>
        {subtitle ? <p className="startup-boot__subtitle">{subtitle}</p> : null}
      </div>
      <div className="startup-boot__sweep" />
    </div>
  );
}

