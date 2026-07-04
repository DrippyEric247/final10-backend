import { useEffect, useState } from 'react';
import { getScoutScanActivity, subscribeScoutScanActivity } from '../lib/scoutScanActivity';

export function useScoutScanActivity() {
  const [state, setState] = useState(() => getScoutScanActivity());

  useEffect(() => {
    setState(getScoutScanActivity());
    return subscribeScoutScanActivity(setState);
  }, []);

  return state;
}
