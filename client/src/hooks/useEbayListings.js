import { useQuery } from '@tanstack/react-query';
import ebayService from '../services/ebayService';

export function useEbayListings({
  enabled = false,
  query = '',
  categoryId = '',
  listingMode = 'mixed',
  limit = 24,
}) {
  return useQuery({
    queryKey: ['ebayListings', query, categoryId, listingMode, limit],
    enabled,
    queryFn: () =>
      ebayService.searchItems({
        q: query || undefined,
        categoryId: categoryId || undefined,
        listingMode,
        limit,
      }),
    retry: 1,
  });
}

