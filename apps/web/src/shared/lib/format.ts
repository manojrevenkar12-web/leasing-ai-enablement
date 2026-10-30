import { factorScale } from '@/shared/theme/tokens';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroCents = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const factor = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const km = new Intl.NumberFormat('de-DE');

/** Whole euros for prices people scan (list prices, down payments). */
export const formatEuro = (cents: number) => euro.format(Math.round(cents / 100));
/** Euros and cents for the rate people pay every month. */
export const formatRate = (cents: number) => euroCents.format(cents / 100);
export const formatFactor = (f: number) => factor.format(f);
export const formatKm = (n: number) => `${km.format(n)} km`;

export type FactorBand = 'deal' | 'fair' | 'steep';

export function factorBand(f: number): FactorBand {
  if (f < factorScale.deal) return 'deal';
  if (f <= factorScale.steep) return 'fair';
  return 'steep';
}

export const bandLabel: Record<FactorBand, string> = {
  deal: 'Top-Angebot',
  fair: 'Fair',
  steep: 'Teuer',
};

/** Position of a factor on the scale, 0..1, clamped. */
export function factorPosition(f: number): number {
  const p = (f - factorScale.min) / (factorScale.max - factorScale.min);
  return Math.min(1, Math.max(0, p));
}
