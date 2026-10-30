'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import type { Offer } from '@/shared/lib/api';
import { formatEuro, formatFactor, formatKm, formatRate } from '@/shared/lib/format';
import { motion as m } from '@/shared/theme/tokens';
import { FactorScale } from './FactorScale';
import styles from './offers.module.css';

export function OfferRow({ offer, index }: { offer: Offer; index: number }) {
  const reduce = useReducedMotion();
  const delay = index < m.staggerLimit ? index * m.stagger : 0;
  const v = offer.vehicle;

  return (
    <motion.li
      className={styles.row}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: m.base, ease: m.ease, delay }}
    >
      <div className={styles.rowVehicle}>
        <h3 className={styles.rowTitle}>
          <Link href={`/offers/${offer.id}`} className={styles.rowLink}>
            {v.make} {v.model}
          </Link>
        </h3>
        <p className={styles.rowMeta}>
          {v.variant} · {offer.dealer.name}, {offer.dealer.city}
        </p>
      </div>
      <dl className={styles.rowTerms}>
        <div>
          <dt>Laufzeit</dt>
          <dd>{offer.term_months} Monate</dd>
        </div>
        <div>
          <dt>Fahrleistung</dt>
          <dd>{formatKm(offer.km_per_year)}/Jahr</dd>
        </div>
        <div>
          <dt>Händlerrabatt</dt>
          <dd>{offer.discount_cents ? `${Math.round((offer.discount_cents / v.list_price_cents) * 100)} %` : 'keiner'}</dd>
        </div>
        <div>
          <dt>Sonderzahlung</dt>
          <dd>{offer.down_payment_cents ? formatEuro(offer.down_payment_cents) : 'keine'}</dd>
        </div>
      </dl>
      <div className={styles.rowRate}>
        <span className={styles.rate}>{formatRate(offer.monthly_rate_cents)}</span>
        <span className={styles.rateUnit}>
          pro Monat {offer.net ? 'netto' : 'brutto'} · Gesamtkosten {formatFactor(offer.total_cost_factor)}
        </span>
      </div>
      <FactorScale factor={offer.leasing_factor} delay={delay + m.base} />
    </motion.li>
  );
}

export function OfferRowSkeleton() {
  return (
    <li className={styles.row} aria-hidden="true">
      <div className={styles.rowVehicle}>
        <span className={styles.skelLine} data-size="title" />
        <span className={styles.skelLine} data-size="meta" />
      </div>
      <div className={styles.rowTerms}>
        <span className={styles.skelLine} data-size="meta" />
      </div>
      <div className={styles.rowRate}>
        <span className={styles.skelLine} data-size="rate" />
      </div>
      <span className={styles.skelLine} data-size="scale" />
    </li>
  );
}
