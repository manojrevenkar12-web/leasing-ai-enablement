'use client';

import { Segmented } from '@/shared/ui/Segmented';
import { EmptyState, ErrorState } from '@/shared/ui/States';
import ui from '@/shared/ui/ui.module.css';
import { OfferRow, OfferRowSkeleton } from './OfferRow';
import { SearchFilters } from './SearchFilters';
import { useOfferSearch } from './useOfferSearch';
import styles from './offers.module.css';

const SKELETON_ROWS = 6;

export function OfferSearch() {
  const { filters, result, set, reset } = useOfferSearch();
  const data = result.data;
  const business = filters.customer_type === 'business';

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Leasing nach Leasingfaktor</h1>
        <p className={styles.lede}>
          Der Leasingfaktor zeigt, was ein Angebot im Verhältnis zum Listenpreis kostet. Unter 0,60 ist es ein Top-Angebot, über 1,00 wird es teuer. Wer eine Sonderzahlung leistet, vergleicht besser den Gesamtkostenfaktor.
        </p>
        <Segmented
          name="customer_type"
          label="Ich lease"
          value={filters.customer_type}
          onChange={(v) => set({ customer_type: v })}
          options={[
            { value: 'private', label: 'privat (brutto)' },
            { value: 'business', label: 'gewerblich (netto)' },
          ]}
        />
      </header>

      <SearchFilters filters={filters} set={set} />

      <section aria-labelledby="results-heading" className={styles.results}>
        <div className={styles.resultsHead}>
          <h2 id="results-heading" className={styles.resultsTitle} aria-live="polite">
            {data ? `${data.meta.total.toLocaleString('de-DE')} Angebote` : 'Angebote werden geladen'}
          </h2>
          <p className={styles.resultsNote}>{business ? 'Alle Preise netto, Faktoren netto zu netto.' : 'Alle Preise inklusive 19 % MwSt.'}</p>
        </div>

        {result.status === 'error' && !data ? (
          <ErrorState title="Die Angebote konnten nicht geladen werden" message={`${result.error.message} Ihre Filter bleiben erhalten.`} onRetry={result.retry} />
        ) : !data ? (
          <ul className={styles.list} aria-busy="true" aria-label="Angebote werden geladen">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <OfferRowSkeleton key={i} />
            ))}
          </ul>
        ) : data.data.length === 0 ? (
          <EmptyState
            title="Keine Angebote für diese Auswahl"
            message="Mit weniger Filtern oder einer höheren Rate finden Sie mehr Angebote."
            action={
              <button type="button" className={ui.button} onClick={reset}>
                Filter zurücksetzen
              </button>
            }
          />
        ) : (
          <>
            {result.status === 'error' ? (
              <ErrorState title="Aktualisierung fehlgeschlagen" message={`Sie sehen die letzten geladenen Angebote. ${result.error.message}`} onRetry={result.retry} />
            ) : null}
            <ul className={styles.list} aria-busy={result.status === 'loading'} data-stale={result.status === 'loading' || undefined}>
              {data.data.map((o, i) => (
                <OfferRow key={o.id} offer={o} index={i} />
              ))}
            </ul>
            {data.meta.last_page > 1 ? (
              <nav className={styles.pager} aria-label="Seiten">
                <button type="button" className={ui.buttonQuiet} disabled={data.meta.page <= 1} onClick={() => set({ page: data.meta.page - 1 })}>
                  Vorherige Seite
                </button>
                <span>
                  Seite {data.meta.page} von {data.meta.last_page}
                </span>
                <button type="button" className={ui.buttonQuiet} disabled={data.meta.page >= data.meta.last_page} onClick={() => set({ page: data.meta.page + 1 })}>
                  Nächste Seite
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
