// Types and calls for the Laravel API (proxied under /api by next.config.ts).

export type CustomerType = 'private' | 'business';

export interface Offer {
  id: number;
  customer_type: CustomerType;
  net: boolean;
  term_months: number;
  km_per_year: number;
  down_payment_cents: number;
  extra_costs_cents: number;
  discount_cents: number;
  monthly_rate_cents: number;
  leasing_factor: number;
  total_cost_factor: number;
  vehicle: { id: number; make: string; model: string; variant: string; fuel: string; power_kw: number; segment: string; list_price_cents: number };
  dealer: { id: number; name: string; city: string };
}

export interface SearchResult {
  data: Offer[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}

export interface Quote {
  offer_id: number;
  term_months: number;
  km_per_year: number;
  down_payment_cents: number;
  extra_costs_cents: number;
  discount_cents: number;
  monthly_rate_cents: number;
  leasing_factor: number;
  total_cost_factor: number;
  residual_value_cents: number;
  net: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  if (!res.ok) {
    let message = `The leasing service answered ${res.status}.`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  search: (params: URLSearchParams, signal?: AbortSignal) => call<SearchResult>(`/api/offers?${params}`, { signal }),
  makes: (customerType: CustomerType, signal?: AbortSignal) => call<{ data: { make: string; offers: number }[] }>(`/api/offers/makes?customer_type=${customerType}`, { signal }),
  offer: (id: number, signal?: AbortSignal) => call<{ data: Offer }>(`/api/offers/${id}`, { signal }),
  quote: (id: number, body: { term: number; km: number; down_payment_cents: number }, signal?: AbortSignal) =>
    call<{ data: Quote }>(`/api/offers/${id}/quote`, { method: 'POST', body: JSON.stringify(body), signal }),
};
