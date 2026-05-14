import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { parseApiError } from "../lib/apiErrorParsing";

export type CheckoutSessionResponse = {
  url: string;
  sessionId: string;
};

export function useCreateCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async (opts?: { successUrl?: string; cancelUrl?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<CheckoutSessionResponse>("/payments/create-checkout-session", opts || {});
      if (data?.url) {
        window.location.assign(data.url);
        return data;
      }
      throw new Error("Checkout did not return a URL");
    } catch (e: unknown) {
      const msg = parseApiError(e).message;
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { startCheckout, loading, error, clearError: () => setError(null) };
}
