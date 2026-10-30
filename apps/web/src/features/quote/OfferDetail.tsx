'use client';

import Link from 'next/link';
import { api, ApiError } from '@/shared/lib/api';
import { formatEuro, formatKm } from '@/shared/lib/format';
import { useRemote } from '@/shared/lib/useRemote';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States';
import ui from '@/shared/ui/ui.module.css';
import { QuoteCalculator } from './QuoteCalculator';
import styles from './quote.module.css';

const FUEL: Record<string, string> = { petrol: 'Benzin', diesel: 'Diesel', hybrid: 'Hybrid', electric: 'Elektro' };

export function OfferDetail({ id }: { id: number }) {
  const offer = useRemote(`offer:${id}`, (signal) => api.offer(id, signal));

  if (offer.status === 'error' && offer.error instanceof ApiError && offer.error.status === 404) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="Dieses Angebot gibt es nicht mehr"
          message="Der Händler hat es pausiert oder entfernt. Ähnliche Angebote finden Sie in der Suche."
          action={
            <Link href="/" className={ui.button}>
              Zur Angebotssuche
            </Link>
          }
        />
      </div>
    );
  }
  if (offer.status === 'error') {
    return (
      <div className={styles.page}>
        <ErrorState title="Das Angebot konnte nicht geladen werden" message={offer.error.message} onRetry={offer.retry} />
      </div>
    );
  }
  const o = offer.data?.data;
  if (!o) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton width="40%" height="var(--space-7)" label="Angebot wird geladen" />
        <Skeleton width="70%" height="var(--space-4)" />
        <Skeleton width="100%" height="var(--space-8)" />
      </div>
    );
  }

  return (
    <article className={styles.page}>
      <Link href="/" className={styles.back}>
        Alle Angebote
      </Link>
      <header className={styles.head}>
        <h1 className={styles.title}>
          {o.vehicle.make} {o.vehicle.model}
        </h1>
        <p className={styles.sub}>
          {o.vehicle.variant} · {FUEL[o.vehicle.fuel] ?? o.vehicle.fuel} · Listenpreis {formatEuro(o.vehicle.list_price_cents)}
        </p>
        <p className={styles.dealer}>
          Angebot von {o.dealer.name}, {o.dealer.city}. Standard: {o.term_months} Monate, {formatKm(o.km_per_year)} pro Jahr, {o.net ? 'Gewerbe (netto)' : 'Privat (brutto)'}.
        </p>
      </header>
      <QuoteCalculator offer={o} />
    </article>
  );
}
