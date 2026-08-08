/**
 * Client re-export — account progression math lives in @savvy/core.
 */
export {
  ACCOUNT_MAX_LEVEL,
  ACCOUNT_MAX_PRESTIGE,
  ACCOUNT_RANKS,
  cumulativeXpForLevel,
  xpPerPrestigeCycle,
  getAccountRank,
  deriveAccountProgression,
  buildAccountProgressionView,
} from '@savvy/core/config/accountProgression';
