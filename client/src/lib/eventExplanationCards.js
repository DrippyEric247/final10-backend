/**
 * Post-activation explanation cards — educational copy after login reveal.
 */

export const EVENT_EXPLANATION_CARDS = Object.freeze({
  double_points: Object.freeze({
    eventKey: 'double_points',
    theme: 'gold',
    title: '🟡 Double Points Activated',
    intro: 'Earn 2× Savvy Points on qualifying actions while this event is active.',
    body: null,
    examples: null,
    primaryCta: 'Start Earning',
    primaryPath: '/daily-streak',
    secondaryCta: 'Got it',
  }),
  triple_points: Object.freeze({
    eventKey: 'triple_points',
    theme: 'purple',
    title: '🟣 Triple Points Activated',
    intro: 'Earn 3× Savvy Points on qualifying actions while this event is active.',
    body: null,
    examples: null,
    primaryCta: 'Start Earning',
    primaryPath: '/events',
    secondaryCta: 'Got it',
  }),
  savvy_sale: Object.freeze({
    eventKey: 'savvy_sale',
    theme: 'red',
    title: '🔥 Savvy Sale Activated',
    intro: 'Your Savvy Points go further during Savvy Sale.',
    body: 'During this event, eligible Savvy redemptions cost 50% less.',
    examples: Object.freeze([
      'Perk Machine 1 Slot: 20 Savvy → 10 Savvy',
      'Perk Machine 2 Slots: 40 Savvy → 20 Savvy',
      'Perk Machine 3 Slots: 60 Savvy → 30 Savvy',
    ]),
    primaryCta: 'Start Saving',
    primaryPath: '/perk-machine',
    secondaryCta: 'Got it',
  }),
  max_supply_drop: Object.freeze({
    eventKey: 'max_supply_drop',
    theme: 'blue',
    title: '📦 Max Supply Drop Activated',
    intro: 'Rare rewards, bonuses, and special supply drops may appear while this event is active.',
    body: 'Watch the Events Hub and your HUD bubble — claim drops before they expire.',
    examples: null,
    primaryCta: 'Open Supply Drop',
    primaryAction: 'supply_drop',
    secondaryCta: 'Got it',
  }),
});

export function getEventExplanationCard(event) {
  const key = String(event?.eventKey || event?.iconKey || '').trim();
  const card = EVENT_EXPLANATION_CARDS[key];
  if (card) return { ...card, theme: event?.theme || card.theme };
  return {
    eventKey: key,
    theme: event?.theme || 'gold',
    title: `${event?.title || 'Live Event'} Activated`,
    intro: event?.detailBody || event?.subtitle || 'This live event is now active.',
    body: null,
    examples: null,
    primaryCta: 'View Events Hub',
    primaryPath: '/events',
    secondaryCta: 'Got it',
  };
}
