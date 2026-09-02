/**
 * Canonical Perk Machine / Supply Drop source identifiers.
 * Keep grant paths and Mongoose enums aligned — do not bypass validation.
 */

const SUPPLY_DROP_SOURCES = Object.freeze([
  'admin',
  'scoutSupport',
  'scheduler',
  'push',
  'test',
  'perk_machine',
]);

const PERK_MACHINE_SAVVY_REWARD_TYPE = 'perk_machine';
const PERK_MACHINE_CALLING_CARD_DUPLICATE = 'perk_machine_calling_card_duplicate';
const PERK_MACHINE_SUPPLY_DROP_SOURCE = 'perk_machine';
const PERK_MACHINE_EGG_SOURCE = 'perk_machine';
const PERK_MACHINE_EGG_HATCH_SOURCE = 'perk_machine_hatch';
const PERK_MACHINE_COSMETIC_SOURCE = 'perk_machine_spin';

module.exports = {
  SUPPLY_DROP_SOURCES,
  PERK_MACHINE_SAVVY_REWARD_TYPE,
  PERK_MACHINE_CALLING_CARD_DUPLICATE,
  PERK_MACHINE_SUPPLY_DROP_SOURCE,
  PERK_MACHINE_EGG_SOURCE,
  PERK_MACHINE_EGG_HATCH_SOURCE,
  PERK_MACHINE_COSMETIC_SOURCE,
};
