import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Offer, SearchResult } from '@/shared/lib/api';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/',
}));

const { OfferSearch } = await import('@/features/offers/OfferSearch');
const { FactorScale } = await import('@/features/offers/FactorScale');

const offer = (id: number, factor: number): Offer => ({
  id,
  customer_type: 'private',
  net: false,
  term_months: 36,
  km_per_year: 10000,
  down_payment_cents: 0,
  extra_costs_cents: 89900,
  discount_cents: 500000,
  monthly_rate_cents: 29990,
  leasing_factor: factor,
  total_cost_factor: factor + 0.05,
  vehicle: { id: 1, make: 'Skoda', model: `Octavia ${id}`, variant: 'Style', fuel: 'diesel', power_kw: 110, segment: 'compact', list_price_cents: 3449000 },
  dealer: { id: 1, name: 'Autohaus Test', city: 'Düsseldorf' },
});
const page = (offers: Offer[], total = offers.length): SearchResult => ({ data: offers, meta: { page: 1, per_page: 24, total, last_page: 1 } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function routeFetch(search: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/offers/makes')) return json({ data: [{ make: 'Skoda', offers: 2 }] });
    return search();
  });
}

describe('offer search', () => {
  beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.replace.mockReset();
  });

  it('shows skeleton rows first, then the offers', async () => {
    routeFetch(() => json(page([offer(1, 0.52), offer(2, 0.81)])));
    render(<OfferSearch />);
    expect(screen.getByRole('list', { name: 'Angebote werden geladen' })).toBeTruthy();
    await screen.findByRole('link', { name: 'Skoda Octavia 1' });
    expect(screen.getByRole('heading', { name: '2 Angebote' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Leasingfaktor 0,52, Top-Angebot' })).toBeTruthy();
    expect(screen.getAllByText('14 %')).toHaveLength(2);
  });

  it('explains a failure, keeps the filters, and retries', async () => {
    let fail = true;
    const f = routeFetch(() => (fail ? json({ message: 'Service vorübergehend nicht erreichbar.' }, 503) : json(page([offer(1, 0.52)]))));
    render(<OfferSearch />);
    await screen.findByRole('heading', { name: 'Die Angebote konnten nicht geladen werden' });
    expect(screen.getByText(/Service vorübergehend nicht erreichbar\. Ihre Filter bleiben erhalten\./)).toBeTruthy();
    fail = false;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })));
    await screen.findByRole('link', { name: 'Skoda Octavia 1' });
    expect(f.mock.calls.filter(([u]) => String(u).startsWith('/api/offers?')).length).toBe(2);
  });

  it('offers a way out of an empty result', async () => {
    nav.params = new URLSearchParams('make=Skoda&max_rate_eur=50');
    routeFetch(() => json(page([])));
    render(<OfferSearch />);
    await screen.findByRole('heading', { name: 'Keine Angebote für diese Auswahl' });
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(nav.replace).toHaveBeenCalledWith('/', { scroll: false });
  });

  it('puts filters in the URL and starts again at page one', async () => {
    nav.params = new URLSearchParams('page=3');
    routeFetch(() => json(page([offer(1, 0.52)])));
    render(<OfferSearch />);
    await screen.findByRole('link', { name: 'Skoda Octavia 1' });
    fireEvent.change(screen.getByLabelText('Antrieb'), { target: { value: 'electric' } });
    expect(nav.replace).toHaveBeenLastCalledWith('/?fuel=electric', { scroll: false });
    fireEvent.click(screen.getByLabelText('gewerblich (netto)'));
    expect(nav.replace).toHaveBeenLastCalledWith('/?customer_type=business', { scroll: false });
  });

  it('asks the API with the filters from the URL', async () => {
    nav.params = new URLSearchParams('customer_type=business&term=36&sort=rate');
    const f = routeFetch(() => json(page([offer(1, 0.52)])));
    render(<OfferSearch />);
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/offers?'))).toBe(true));
    const url = String(f.mock.calls.find(([u]) => String(u).startsWith('/api/offers?'))?.[0]);
    expect(new URLSearchParams(url.split('?')[1])).toEqual(new URLSearchParams('customer_type=business&term=36&sort=rate&per_page=24'));
    await screen.findByText('Alle Preise netto, Faktoren netto zu netto.');
  });
});

describe('factor scale', () => {
  it('names the factor and its band for screen readers', () => {
    render(<FactorScale factor={1.24} />);
    expect(screen.getByRole('img', { name: 'Leasingfaktor 1,24, Teuer' })).toBeTruthy();
  });
});
