import type { ReactNode } from "react";

/**
 * Shape of /api/auth/me hydrated into AuthProvider (extend as new fields are added to the API).
 */
export interface AuthUser {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Server-issued Savvy balance before dev-only fake offset is applied. */
  savvyPointsServerBase?: number;
  savvyPoints?: number;
  lifetimePointsEarned?: number;
  flipTotalCompleted?: number;
  flipBestScoreEver?: number | null;
  flipAverageScore?: number | null;
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string;
  login: (credentials: unknown) => Promise<unknown>;
  register: (form: unknown) => Promise<unknown>;
  logout: () => void;
  refreshProfile: () => Promise<unknown>;
}

export function AuthProvider(props: { children: ReactNode }): JSX.Element;
export const useAuth: () => AuthContextValue;
