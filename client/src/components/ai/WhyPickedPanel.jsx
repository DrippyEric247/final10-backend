import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SCOUT_LABELS } from '../../config/savvyScoutBranding';
import { buildWhySavvyPickedModel } from '../../lib/mockWhySavvyPicked';
import AIConfidenceBar from './AIConfidenceBar';
import MarketSignalCard from './MarketSignalCard';
import TimingInsightRow from './TimingInsightRow';
import TrustBreakdown from './TrustBreakdown';
import '../../styles/why-savvy-picked.css';

/**
 * Expandable “Why Savvy Scout picked this” — mock copy from `mockWhySavvyPicked.ts`.
 */
export default function WhyPickedPanel({ item, trustResult, decision, effectiveSavings }) {
  const [open, setOpen] = useState(false);

  const model = useMemo(
    () =>
      buildWhySavvyPickedModel({
        item: item || {},
        trustResult,
        decision,
        effectiveSavings: Number(effectiveSavings) || 0,
      }),
    [item, trustResult, decision, effectiveSavings]
  );

  return (
    <div className="wsp-wrap">
      <button
        type="button"
        className="wsp-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wsp-toggle__glow" aria-hidden />
        <span className="wsp-toggle__label">{SCOUT_LABELS.whyPickedToggle}</span>
        <span className="wsp-toggle__chev">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="why-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="wsp-panel-outer"
          >
            <div className="wsp-panel wsp-panel--scan">
              <div className="wsp-reasons">
                {model.reasons.map((r) => (
                  <div key={r} className="wsp-reason">
                    <span className="wsp-reason__tick" aria-hidden>
                      ✔
                    </span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              <AIConfidenceBar tier={model.aiTier} percent={model.aiPercent} />

              <div className="wsp-intel">
                <MarketSignalCard icon="📈" title="Market Trend" pulse>
                  {model.marketTrend}
                </MarketSignalCard>
                <MarketSignalCard icon="👀" title="Competition Analysis">
                  {model.competitionLine}
                </MarketSignalCard>
                <MarketSignalCard icon="💰" title="Price Delta" pulse>
                  {model.priceDeltaLine}
                </MarketSignalCard>
                <TimingInsightRow text={model.timingLine} />
              </div>

              {model.showTrustPanel ? <TrustBreakdown bullets={model.trustBullets} /> : null}

              <div className="wsp-summary">
                <div className="wsp-summary__title">{SCOUT_LABELS.summary}</div>
                <p className="wsp-summary__text">{model.summary}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
