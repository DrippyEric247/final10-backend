import { useMutation, useQuery } from '@tanstack/react-query';
import ebayService from '../services/ebayService';

export function useEbayConnectionStatus(enabled = true) {
  return useQuery({
    queryKey: ['ebayConnectionStatus'],
    queryFn: () => ebayService.getConnectionStatus(),
    enabled,
    retry: 1,
  });
}

export function usePlaceEbayBid() {
  return useMutation({
    mutationFn: ({ itemId, maxAmount, currency }) =>
      ebayService.placeBid({ itemId, maxAmount, currency }),
  });
}

