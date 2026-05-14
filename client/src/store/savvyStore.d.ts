import type { ReactNode } from "react";

export interface SavvyPointsContextValue {
  savvyPoints: number;
  displaySavvy: number;
  multiplier: number;
  streak: number;
  lifetimeEarned: number;
  recentTransactions: Array<{
    id: string;
    delta: number;
    label: string;
    sourceType?: string;
    ts: number;
    kind: string;
  }>;
  recentFeed: Array<{
    id: string;
    amount: number;
    sign: number;
    headline: string;
    rarity: string;
    ts: number;
    _src?: number;
  }>;
  awardPoints: (type: string, amount?: number, rarity?: string, origin?: unknown) => void;
  spendPoints: (amount: number, label?: string) => void;
  syncPoints: () => Promise<unknown>;
  animatePointGain: (amount: number, opts?: Record<string, unknown>) => void;
  isAuthenticated: boolean;
}

export function SavvyPointsProvider(props: { children: ReactNode }): JSX.Element;
export function useSavvyPoints(): SavvyPointsContextValue;
export const SAVVY_AUTH_REFRESH_REQUEST: string;
export const SAVVY_STORE_UPDATED: string;
