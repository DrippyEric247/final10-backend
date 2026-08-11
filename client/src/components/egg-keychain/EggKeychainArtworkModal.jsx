import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { EGG_KEYCHAIN_DISPLAY_NAME, formatKeychainSerial } from '@savvy/core/config/eggKeychainCollection';

function formatUnlockDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function tierLabel(item) {
  if (item?.classified && !item?.unlocked) return item.lockedBadge || 'CLASSIFIED';
  if (item?.quantumLegacy) return 'QUANTUM';
  if (item?.nukeCollection) return 'NUKE';
  return String(item?.tier || item?.rarity || 'MYTHIC').toUpperCase();
}

/**
 * Full reference-sheet artwork viewer — object-fit contain, no crop.
 * @param {{ item: object|null, onClose: () => void, collectionTagline?: string }} props
 */
export default function EggKeychainArtworkModal({ item, onClose, collectionTagline = '' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!item?.imageUrl) return null;

  const lockedPreview = !item.unlocked;
  const history = item.keychainHistory;
  const serial = item.serialNumber != null ? formatKeychainSerial(item.serialNumber) : null;
  const collectionLine = item.quantumLegacy
    ? item.collectionLabel || 'QUANTUM LEGACY'
    : item.nukeCollection
      ? item.collectionLabel || 'NUKE COLLECTION'
      : EGG_KEYCHAIN_DISPLAY_NAME;
  const lockedRequirement =
    item.unlockRule?.lockedRequirementLabel || item.unlockRule?.description || 'Earn through official Savvy rewards.';
  const acquiredLine = item.acquiredLabel || `${item.name} ACQUIRED`;
  const itemTagline = item.unlocked ? item.tagline : collectionTagline || item.tagline;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className={`f10-egg-keychain-artwork ${lockedPreview ? 'f10-egg-keychain-artwork--locked' : ''} ${
          item.nukeCollection ? 'f10-egg-keychain-artwork--nuke' : ''
        } ${item.quantumLegacy ? 'f10-egg-keychain-artwork--quantum' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} artwork`}
      >
        <button
          type="button"
          className="f10-egg-keychain-artwork__backdrop"
          aria-label="Close artwork"
          onClick={onClose}
        />
        <motion.div
          className="f10-egg-keychain-artwork__panel"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          <button type="button" className="f10-egg-keychain-artwork__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>

          <div className="f10-egg-keychain-artwork__head">
            <div className="f10-egg-keychain-artwork__collection">{collectionLine}</div>
            <h3>{item.name}</h3>
            <span className="f10-egg-keychain-artwork__rarity">{tierLabel(item)}</span>
            {lockedPreview ? (
              <>
                <span className="f10-egg-keychain-artwork__locked-badge">
                  <Lock size={11} strokeWidth={2.5} aria-hidden /> LOCKED
                </span>
                <span className="f10-egg-keychain-artwork__requirement">{lockedRequirement}</span>
              </>
            ) : (
              <>
                <span className="f10-egg-keychain-artwork__acquired">{acquiredLine}</span>
                {serial ? (
                  <span className="f10-egg-keychain-artwork__serial">
                    {item.name} #{serial}
                  </span>
                ) : null}
                {item.tagline ? (
                  <span className="f10-egg-keychain-artwork__earned-tagline">{item.tagline}</span>
                ) : null}
              </>
            )}
          </div>

          <div
            className={`f10-egg-keychain-artwork__frame ${
              item.nukeCollection || item.quantumLegacy ? 'f10-egg-keychain-artwork__frame--landscape' : ''
            }`}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              className="f10-egg-keychain-artwork__img"
              loading="eager"
            />
          </div>

          {item.unlocked && history ? (
            <div className="f10-egg-keychain-artwork__history">
              <h4>YOUR KEYCHAIN HISTORY</h4>
              <dl>
                {serial ? (
                  <>
                    <dt>Serial</dt>
                    <dd>#{serial}</dd>
                  </>
                ) : null}
                {history.levelAtUnlock != null ? (
                  <>
                    <dt>Level at Unlock</dt>
                    <dd>{history.levelAtUnlock}</dd>
                  </>
                ) : null}
                {history.prestigeAtUnlock != null ? (
                  <>
                    <dt>Prestige at Unlock</dt>
                    <dd>{history.prestigeAtUnlock}</dd>
                  </>
                ) : null}
                {history.earnedThrough ? (
                  <>
                    <dt>Earned Through</dt>
                    <dd>{history.earnedThrough}</dd>
                  </>
                ) : null}
                {history.nukeStatus ? (
                  <>
                    <dt>Nuke Status</dt>
                    <dd>{history.nukeStatus}</dd>
                  </>
                ) : null}
                {history.quantumStatus ? (
                  <>
                    <dt>Quantum Status</dt>
                    <dd>{history.quantumStatus}</dd>
                  </>
                ) : null}
                {history.achievementId ? (
                  <>
                    <dt>Achievement</dt>
                    <dd>{history.achievementId}</dd>
                  </>
                ) : null}
                {history.unlockedOn ? (
                  <>
                    <dt>Unlocked On</dt>
                    <dd>{formatUnlockDate(history.unlockedOn)}</dd>
                  </>
                ) : null}
              </dl>
              {item.streamHouseEligible ? (
                <p className="f10-egg-keychain-artwork__stream">
                  Stream House eligible · {(item.streamHouseTier || item.streamHouseRarity || 'MYTHIC').toUpperCase()}{' '}
                  tier pool
                </p>
              ) : null}
            </div>
          ) : null}

          {lockedPreview && item.previewWhenLocked ? (
            <p className="f10-egg-keychain-artwork__preview-note">
              {item.lockedPreviewNote ||
                'Premium preview — digital collectible earned through official Savvy rewards. Not purchasable.'}
            </p>
          ) : null}

          {item.secondaryTagline && !lockedPreview ? (
            <p className="f10-egg-keychain-artwork__secondary-tagline">{item.secondaryTagline}</p>
          ) : null}

          {itemTagline ? <p className="f10-egg-keychain-artwork__tagline">{itemTagline}</p> : null}

          <button type="button" className="f10-camo-btn--ghost f10-egg-keychain-artwork__done" onClick={onClose}>
            CLOSE
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
