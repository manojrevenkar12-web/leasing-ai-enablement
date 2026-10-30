'use client';

import { api } from '@/shared/lib/api';
import { formatKm } from '@/shared/lib/format';
import { useRemote } from '@/shared/lib/useRemote';
import { quote } from '@/shared/theme/tokens';
import type { Filters } from './useOfferSearch';
import styles from './offers.module.css';

const FUELS = [
  ['', 'Alle Antriebe'],
  ['petrol', 'Benzin'],
  ['diesel', 'Diesel'],
  ['hybrid', 'Hybrid'],
  ['electric', 'Elektro'],
] as const;

const SORTS = [
  ['factor', 'Leasingfaktor'],
  ['total', 'Gesamtkostenfaktor'],
  ['rate', 'Monatsrate'],
  ['newest', 'Neueste'],
] as const;

export function SearchFilters({ filters, set }: { filters: Filters; set: (p: Partial<Filters>) => void }) {
  const makes = useRemote(`makes:${filters.customer_type}`, (signal) => api.makes(filters.customer_type, signal));

  return (
    <form className={styles.filters} onSubmit={(e) => e.preventDefault()} aria-label="Angebote filtern">
      <label className={styles.field}>
        <span>Marke</span>
        <select value={filters.make} onChange={(e) => set({ make: e.target.value })} disabled={makes.status === 'loading' && !makes.data} aria-describedby={makes.status === 'error' ? 'makes-error' : undefined}>
          <option value="">{makes.status === 'loading' && !makes.data ? 'Marken werden geladen…' : 'Alle Marken'}</option>
          {makes.data?.data.map((m) => (
            <option key={m.make} value={m.make}>
              {m.make} ({m.offers})
            </option>
          ))}
        </select>
        {makes.status === 'error' ? (
          <span id="makes-error" className={styles.fieldError}>
            Marken nicht geladen.{' '}
            <button type="button" className={styles.inlineButton} onClick={makes.retry}>
              Erneut laden
            </button>
          </span>
        ) : null}
      </label>
      <label className={styles.field}>
        <span>Antrieb</span>
        <select value={filters.fuel} onChange={(e) => set({ fuel: e.target.value })}>
          {FUELS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Laufzeit</span>
        <select value={filters.term} onChange={(e) => set({ term: e.target.value })}>
          <option value="">Alle</option>
          {quote.terms.map((t) => (
            <option key={t} value={t}>
              {t} Monate
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Kilometer pro Jahr</span>
        <select value={filters.km} onChange={(e) => set({ km: e.target.value })}>
          <option value="">Alle</option>
          {quote.mileages.map((k) => (
            <option key={k} value={k}>
              {formatKm(k)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Rate bis (€)</span>
        <input inputMode="numeric" pattern="[0-9]*" value={filters.max_rate_eur} placeholder="z. B. 350" onChange={(e) => set({ max_rate_eur: e.target.value.replace(/\D/g, '').slice(0, 5) })} />
      </label>
      <label className={styles.field}>
        <span>Sortieren nach</span>
        <select value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
