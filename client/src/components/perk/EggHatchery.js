import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EggCard from './EggCard';
import EggHatchModal from './EggHatchModal';
import { buildOwnedEggs } from '../../lib/eggHatchery';
import '../../styles/EggExchange.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

/**
 * Egg Hatchery section: responsive grid of owned eggs, cinematic hatch modal,
 * and an empty state that nudges the player back to the Perk Machine.
 *
 * @param {object} props
 * @param {object} props.eggInventory  server eggInventory map
 * @param {(eggTier: string) => Promise<object>} props.onHatch  performs the hatch, returns server result
 * @param {(status: object) => void} props.onStatusUpdate  receives fresh status after a hatch
 * @param {() => void} [props.onSpinClick]  empty-state CTA
 */
export default function EggHatchery({ eggInventory, onHatch, onStatusUpdate, onSpinClick }) {
  const [activeEgg, setActiveEgg] = useState(null);

  const ownedEggs = useMemo(() => buildOwnedEggs(eggInventory), [eggInventory]);

  const handleHatchClick = useCallback((tier) => {
    setActiveEgg(tier);
  }, []);

  const closeModal = useCallback(() => setActiveEgg(null), []);

  return (
    <section className="egg-hatchery" id="egg-hatchery">
      <header className="egg-hatchery__header">
        <h2 className="egg-hatchery__title">🥚 Egg Hatchery</h2>
        <p className="egg-hatchery__subtitle">Collect. Hatch. Power Up Savvy Scout.</p>
      </header>

      {ownedEggs.length > 0 ? (
        <div className="egg-hatchery__grid">
          {ownedEggs.map((tier) => (
            <EggCard key={tier.key} tier={tier} onHatch={handleHatchClick} disabled={Boolean(activeEgg)} />
          ))}
        </div>
      ) : (
        <div className="egg-hatchery__empty">
          <div className="egg-hatchery__empty-scout">
            <img src={SCOUT_IMG} alt="" aria-hidden />
          </div>
          <p className="egg-hatchery__empty-msg">
            No eggs yet, Operator.
            <br />
            Keep spinning the Perk Machine to discover rare eggs and power me up.
          </p>
          <button type="button" className="egg-hatchery__empty-btn" onClick={onSpinClick}>
            🎰 Spin Perk Machine
          </button>
        </div>
      )}

      {activeEgg ? (
        <EggHatchModal
          tier={activeEgg}
          onHatch={onHatch}
          onClose={closeModal}
          onStatusUpdate={onStatusUpdate}
        />
      ) : null}

      <div className="egg-hatchery__exchange-link">
        <Link to="/egg-exchange">🧪 Egg Exchange Chamber — fuse into higher tiers</Link>
      </div>
    </section>
  );
}
