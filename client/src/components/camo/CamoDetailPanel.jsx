import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Circle, Lock } from 'lucide-react';
import CamoImage from './CamoImage';

function formatSerial(serial) {
  if (serial == null) return null;
  return `#${String(serial).padStart(6, '0')}`;
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Full detail view for one camo item, plus the same camo across every other
 * category (the cross-category "Tiger Collection").
 *
 * @param {object} props
 * @param {object} props.item
 * @param {object[]} props.items every locker item (for related lookups)
 * @param {() => void} props.onBack
 * @param {(item: object) => void} props.onSelectItem
 * @param {(item: object) => void} [props.onClaim]
 * @param {boolean} [props.claiming]
 */
export default function CamoDetailPanel({
  item,
  items,
  onBack,
  onSelectItem,
  onClaim,
  claiming = false,
}) {
  const related = useMemo(
    () => (items || []).filter((i) => i.camo === item.camo && i.id !== item.id),
    [items, item]
  );

  const unlocked = Boolean(item.unlocked);
  const serial = formatSerial(item.serialNumber);
  const unlockDate = formatDate(item.unlockedAt);
  const requirementMet = item.current >= item.target;

  return (
    <motion.div
      className="f10-camo-detail"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      style={{ '--camo-accent': item.accentColor, '--camo-accent-alt': item.accentColorAlt }}
    >
      <button type="button" className="f10-camo-back" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> Back
      </button>

      <div className="f10-camo-detail__grid">
        <div className={`f10-camo-detail__stage f10-camo-detail__stage--${item.rarity}`}>
          <CamoImage
            src={item.previewImageUrl}
            alt={item.name}
            accentColor={item.accentColor}
            loading="eager"
            dimmed={!unlocked}
            className="f10-camo-img--hero"
          />
          <span
            className={`f10-camo-detail__status f10-camo-detail__status--${
              unlocked ? 'unlocked' : 'locked'
            }`}
          >
            {unlocked ? (
              'UNLOCKED'
            ) : (
              <>
                <Lock size={11} strokeWidth={2.5} aria-hidden /> LOCKED
              </>
            )}
          </span>
        </div>

        <div className="f10-camo-detail__info">
          <div className="f10-camo-detail__rarity">{item.rarityLabel}</div>
          <h3 className="f10-camo-detail__title">{item.name}</h3>
          <div className="f10-camo-detail__sub">
            {item.categoryName} Collection · {item.collectionName}
          </div>

          {item.privateReward ? (
            <div className="f10-camo-detail__private">
              <div className="f10-camo-detail__private-label">PRIVATE REWARD</div>
              <p>Visibility: Admin / Owner Only</p>
              <p className="f10-camo-detail__private-note">
                This reward is hidden from public locker views, search, and collection counts until
                released.
              </p>
            </div>
          ) : null}

          <div className="f10-camo-detail__section">
            <div className="f10-camo-detail__label">Unlock Requirements</div>
            <ul className="f10-camo-detail__reqs">
              <li className={requirementMet ? 'is-met' : ''}>
                {requirementMet ? (
                  <Check size={13} strokeWidth={3} aria-hidden />
                ) : (
                  <Circle size={13} strokeWidth={2.4} aria-hidden />
                )}
                <span>
                  {item.requirementText}
                  <em>
                    {' '}
                    ({item.current.toLocaleString()} / {item.target.toLocaleString()})
                  </em>
                </span>
              </li>
              {(item.gateStatus || []).map((gate) => (
                <li key={gate.label} className={gate.met ? 'is-met' : ''}>
                  {gate.met ? (
                    <Check size={13} strokeWidth={3} aria-hidden />
                  ) : (
                    <Circle size={13} strokeWidth={2.4} aria-hidden />
                  )}
                  <span>{gate.label}</span>
                </li>
              ))}
            </ul>
            {!unlocked ? (
              <div className="f10-camo-card__track">
                <div
                  className="f10-camo-card__fill"
                  style={{ width: `${Math.min(100, item.progress)}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="f10-camo-detail__section">
            <div className="f10-camo-detail__label">About This Reward</div>
            <p className="f10-camo-detail__about">“{item.about}”</p>
          </div>

          {unlocked ? (
            <div className="f10-camo-detail__owned">
              {serial ? (
                <div className="f10-camo-detail__stat">
                  <span>Serial</span>
                  <strong>{serial}</strong>
                </div>
              ) : null}
              {unlockDate ? (
                <div className="f10-camo-detail__stat">
                  <span>Earned</span>
                  <strong>{unlockDate}</strong>
                </div>
              ) : null}
              {item.capturedProfileLevel != null ? (
                <div className="f10-camo-detail__stat">
                  <span>Level at unlock</span>
                  <strong>{item.capturedProfileLevel}</strong>
                </div>
              ) : null}
              {item.capturedPrestige != null ? (
                <div className="f10-camo-detail__stat">
                  <span>Prestige at unlock</span>
                  <strong>{item.capturedPrestige}</strong>
                </div>
              ) : null}
              {item.capturedEmblemId ? (
                <div className="f10-camo-detail__stat">
                  <span>Emblem at unlock</span>
                  <strong>{item.capturedEmblemId}</strong>
                </div>
              ) : null}
              {item.capturedCallingCardId ? (
                <div className="f10-camo-detail__stat">
                  <span>Calling card at unlock</span>
                  <strong>{item.capturedCallingCardId}</strong>
                </div>
              ) : null}
              {item.capturedUsername ? (
                <div className="f10-camo-detail__stat">
                  <span>Operator at unlock</span>
                  <strong>{item.capturedUsername}</strong>
                </div>
              ) : null}
            </div>
          ) : item.privateReward ? (
            <div className="f10-camo-detail__section">
              <div className="f10-camo-detail__label">Nuke Reward Data</div>
              <p className="f10-camo-detail__about">
                When earned, this reward permanently captures serial number, user ID, username,
                profile level, prestige, emblem, calling card, and unlock timestamp.
              </p>
            </div>
          ) : null}

          <div className="f10-camo-detail__actions">
            {unlocked ? (
              <button
                type="button"
                className="f10-camo-btn f10-camo-btn--primary"
                onClick={() => onClaim?.(item)}
                disabled={claiming || Boolean(item.claimedAt)}
              >
                {item.claimedAt ? 'CLAIM RECORDED' : claiming ? 'SAVING…' : 'CLAIM REWARD'}
              </button>
            ) : (
              <div className="f10-camo-detail__locked-note">
                <Lock size={12} strokeWidth={2.5} aria-hidden /> Complete the requirements to equip
                or claim this reward.
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length ? (
        <div className="f10-camo-detail__related">
          <div className="f10-camo-detail__label">
            {item.collectionName} — across every category
          </div>
          <div className="f10-camo-related">
            {related.map((rel) => (
              <button
                key={rel.id}
                type="button"
                className={`f10-camo-related__item ${
                  rel.unlocked ? 'is-unlocked' : 'is-locked'
                }`}
                onClick={() => onSelectItem?.(rel)}
                style={{ '--camo-accent': rel.accentColor }}
              >
                <CamoImage
                  src={rel.imageUrl}
                  alt={rel.name}
                  accentColor={rel.accentColor}
                  dimmed={!rel.unlocked}
                />
                <span className="f10-camo-related__label">{rel.rewardTypeName}</span>
                <span className="f10-camo-related__cat">{rel.categoryName}</span>
                <span className="f10-camo-related__state" aria-hidden>
                  {rel.unlocked ? '✓' : '🔒'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
