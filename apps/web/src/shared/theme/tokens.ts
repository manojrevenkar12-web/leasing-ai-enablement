// Values components need in JavaScript (motion, layout maths). CSS uses tokens.css.

export const motion = {
  /** seconds, for Motion */
  fast: 0.12,
  base: 0.22,
  reveal: 0.42,
  stagger: 0.035,
  ease: [0.2, 0.8, 0.2, 1] as const,
  /** rows after this index appear without a stagger, so long lists do not crawl in */
  staggerLimit: 12,
};

/** Leasing factor thresholds as German buyers read them: under 0.6 a deal, over 1.0 steep. */
export const factorScale = {
  min: 0.3,
  max: 1.6,
  deal: 0.6,
  steep: 1.0,
};

export const search = {
  perPage: 24,
  /** wait this long after the last keystroke or slider move before asking the API */
  debounceMs: 250,
};

export const quote = {
  terms: [24, 36, 48, 60] as const,
  mileages: [10000, 15000, 20000, 30000] as const,
  downPaymentStepCents: 50000,
  /** the API rejects more than half the list price */
  maxDownPaymentShare: 0.5,
};
