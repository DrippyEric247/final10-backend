import { useEffect, useState } from "react";
import { getApiCoolingState, subscribeApiCooling } from "../lib/apiRequestGate";

/** Quiet UI hook — true while backing off after a server HTTP 429. */
export function useApiCooling() {
  const [state, setState] = useState(() => getApiCoolingState());

  useEffect(() => {
    setState(getApiCoolingState());
    return subscribeApiCooling(setState);
  }, []);

  return state;
}
