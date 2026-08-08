import React from 'react';
import { Shirt } from 'lucide-react';
import { openCamoLocker } from '../../lib/camoLockerBus';
import '../../styles/CamoLocker.css';

/**
 * Universal Camo Locker entry point. Drop anywhere — wallet menu, profile,
 * More menu, rewards area, Scout menu, a game HUD.
 *
 * @param {object} props
 * @param {'pill'|'nav'|'icon'|'block'} [props.variant]
 * @param {string} [props.label]
 * @param {string} [props.category] deep-link into a category
 * @param {string} [props.camo] deep-link into a camo collection
 * @param {string} [props.source] debug label for where the tap came from
 * @param {string} [props.className]
 * @param {() => void} [props.onOpen] fires after the locker is requested
 */
export default function CamoLockerButton({
  variant = 'pill',
  label = 'CAMO LOCKER',
  category,
  camo,
  source = 'camo_locker_button',
  className = '',
  onOpen,
}) {
  const handleClick = () => {
    openCamoLocker({ category, camo, source });
    onOpen?.();
  };

  const iconSize = variant === 'icon' ? 20 : variant === 'block' ? 22 : 16;

  return (
    <button
      type="button"
      className={`f10-camo-entry f10-camo-entry--${variant} ${className}`.trim()}
      onClick={handleClick}
      title="Open the Savvy Camo Locker"
      aria-label="Open the Savvy Camo Locker"
    >
      <span className="f10-camo-entry__icon" aria-hidden>
        <Shirt size={iconSize} strokeWidth={2.2} />
      </span>
      {variant === 'icon' ? null : <span className="f10-camo-entry__label">{label}</span>}
    </button>
  );
}
