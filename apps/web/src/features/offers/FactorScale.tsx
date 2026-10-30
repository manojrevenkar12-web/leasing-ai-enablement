'use client';

import { motion, useReducedMotion } from 'motion/react';
import { bandLabel, factorBand, factorPosition, formatFactor } from '@/shared/lib/format';
import { factorScale, motion as m } from '@/shared/theme/tokens';
import styles from './offers.module.css';

const PCT = 100;

/**
 * Where an offer's leasing factor sits between a great deal and a steep one. The marker slides in
 * once, when the offer first appears; afterwards it simply moves.
 */
export function FactorScale({ factor, delay = 0, compact = false }: { factor: number; delay?: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  const band = factorBand(factor);
  const left = `${factorPosition(factor) * PCT}%`;
  const deal = `${factorPosition(factorScale.deal) * PCT}%`;
  const steep = `${factorPosition(factorScale.steep) * PCT}%`;

  return (
    <div className={styles.scale} data-compact={compact || undefined} role="img" aria-label={`Leasingfaktor ${formatFactor(factor)}, ${bandLabel[band]}`}>
      <div className={styles.scaleHead} aria-hidden="true">
        <span className={styles.scaleValue} data-band={band}>
          {formatFactor(factor)}
        </span>
        <span className={styles.scaleBand} data-band={band}>
          {bandLabel[band]}
        </span>
      </div>
      <div className={styles.scaleTrack} aria-hidden="true" style={{ ['--deal' as string]: deal, ['--steep' as string]: steep }}>
        <motion.span
          className={styles.scaleMarker}
          data-band={band}
          initial={reduce ? false : { left: '0%', opacity: 0 }}
          animate={{ left, opacity: 1 }}
          transition={{ duration: m.reveal, ease: m.ease, delay }}
        />
      </div>
    </div>
  );
}
