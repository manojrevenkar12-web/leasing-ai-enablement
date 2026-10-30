'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { FactorScale } from '@/features/offers/FactorScale';
import { api, type Offer } from '@/shared/lib/api';
import { formatEuro, formatFactor, formatKm, formatRate } from '@/shared/lib/format';
import { useRemote } from '@/shared/lib/useRemote';
import { motion as m, quote, search } from '@/shared/theme/tokens';
import { Segmented } from '@/shared/ui/Segmented';
import { Skeleton } from '@/shared/ui/States';
import ui from '@/shared/ui/ui.module.css';
import styles from './quote.module.css';

/** The rate for the customer's own term, mileage and down payment, as they change them. */
export function QuoteCalculator({ offer }: { offer: Offer }) {
  const reduce = useReducedMotion();
  const [term, setTerm] = useState(offer.term_months);
  const [km, setKm] = useState(offer.km_per_year);
  const [down, setDown] = useState(offer.down_payment_cents);
  const maxDown = Math.floor((offer.vehicle.list_price_cents * quote.maxDownPaymentShare) / quote.downPaymentStepCents) * quote.downPaymentStepCents;

  const key = `${offer.id}:${term}:${km}:${down}`;
  const q = useRemote(key, (signal) => api.quote(offer.id, { term, km, down_payment_cents: down }, signal), search.debounceMs);
  const data = q.data?.data;

  return (
    <section className={styles.calculator} aria-labelledby="calc-heading">
      <h2 id="calc-heading" className={styles.heading}>
        Ihre Rate berechnen
      </h2>
      <div className={styles.controls}>
        <Segmented name="term" label="Laufzeit" value={term} onChange={setTerm} options={quote.terms.map((t) => ({ value: t, label: `${t} Monate` }))} />
        <Segmented name="km" label="Kilometer pro Jahr" value={km} onChange={setKm} options={quote.mileages.map((k) => ({ value: k, label: formatKm(k) }))} />
        <label className={styles.range}>
          <span className={styles.rangeLabel}>
            Sonderzahlung <strong>{down ? formatEuro(down) : 'keine'}</strong>
          </span>
          <input type="range" min={0} max={maxDown} step={quote.downPaymentStepCents} value={down} onChange={(e) => setDown(Number(e.target.value))} aria-valuetext={down ? formatEuro(down) : 'keine Sonderzahlung'} />
        </label>
      </div>

      <div className={styles.result} aria-live="polite" aria-busy={q.status === 'loading'}>
        {q.status === 'error' ? (
          <div role="alert" className={styles.error}>
            <p>Die Rate konnte nicht berechnet werden: {q.error.message}</p>
            <button type="button" className={ui.buttonQuiet} onClick={q.retry}>
              Erneut berechnen
            </button>
          </div>
        ) : !data ? (
          <div className={styles.resultGrid}>
            <Skeleton width="60%" height="var(--space-7)" label="Rate wird berechnet" />
            <Skeleton width="100%" height="var(--space-5)" />
          </div>
        ) : (
          <div className={styles.resultGrid} data-stale={q.status === 'loading' || undefined}>
            <div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={data.monthly_rate_cents}
                  className={styles.rate}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: m.fast, ease: m.ease }}
                >
                  {formatRate(data.monthly_rate_cents)}
                </motion.p>
              </AnimatePresence>
              <p className={styles.rateUnit}>pro Monat {data.net ? 'netto' : 'brutto'}</p>
            </div>
            <FactorScale factor={data.leasing_factor} />
            <dl className={styles.facts}>
              <div>
                <dt>Gesamtkostenfaktor</dt>
                <dd>{formatFactor(data.total_cost_factor)}</dd>
              </div>
              <div>
                <dt>Restwert</dt>
                <dd>{formatEuro(data.residual_value_cents)}</dd>
              </div>
              <div>
                <dt>Händlerrabatt</dt>
                <dd>{formatEuro(data.discount_cents)}</dd>
              </div>
              <div>
                <dt>Überführung und Zulassung</dt>
                <dd>{formatEuro(data.extra_costs_cents)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
