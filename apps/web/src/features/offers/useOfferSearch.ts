'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { api, type CustomerType } from '@/shared/lib/api';
import { useRemote } from '@/shared/lib/useRemote';
import { search } from '@/shared/theme/tokens';

export interface Filters {
  customer_type: CustomerType;
  make: string;
  fuel: string;
  term: string;
  km: string;
  max_rate_eur: string;
  sort: 'factor' | 'rate' | 'total' | 'newest';
  page: number;
}

const DEFAULTS: Filters = { customer_type: 'private', make: '', fuel: '', term: '', km: '', max_rate_eur: '', sort: 'factor', page: 1 };

/** Filters live in the URL, so a search can be shared, bookmarked and reloaded. */
export function useOfferSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: Filters = useMemo(
    () => ({
      customer_type: params.get('customer_type') === 'business' ? 'business' : 'private',
      make: params.get('make') ?? '',
      fuel: params.get('fuel') ?? '',
      term: params.get('term') ?? '',
      km: params.get('km') ?? '',
      max_rate_eur: params.get('max_rate_eur') ?? '',
      sort: (['factor', 'rate', 'total', 'newest'] as const).find((s) => s === params.get('sort')) ?? 'factor',
      page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    }),
    [params],
  );

  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== DEFAULTS[k as keyof Filters]) q.set(k, String(v));
    q.set('per_page', String(search.perPage));
    return q;
  }, [filters]);

  const result = useRemote(query.toString(), (signal) => api.search(query, signal), filters.max_rate_eur ? search.debounceMs : 0);

  const set = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, page: 1, ...patch };
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v !== '' && v !== DEFAULTS[k as keyof Filters]) q.set(k, String(v));
      router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const reset = useCallback(() => router.replace(filters.customer_type === 'business' ? `${pathname}?customer_type=business` : pathname, { scroll: false }), [filters.customer_type, pathname, router]);

  return { filters, result, set, reset };
}
