import { describe, expect, it } from 'vitest';
import { bandLabel, factorBand, factorPosition, formatEuro, formatFactor, formatKm, formatRate } from '@/shared/lib/format';

describe('format', () => {
  it('formats money the German way', () => {
    expect(formatRate(51685).replace(/\s/g, ' ')).toBe('516,85 €');
    expect(formatEuro(3331500).replace(/\s/g, ' ')).toBe('33.315 €');
    expect(formatFactor(0.6)).toBe('0,60');
    expect(formatKm(15000)).toBe('15.000 km');
  });

  it('reads leasing factors the way buyers do', () => {
    expect([0.44, 0.59, 0.6, 1.0, 1.01].map(factorBand)).toEqual(['deal', 'deal', 'fair', 'fair', 'steep']);
    expect(bandLabel.deal).toBe('Top-Angebot');
  });

  it('places factors on the scale and clamps the ends', () => {
    expect(factorPosition(0.3)).toBe(0);
    expect(factorPosition(1.6)).toBe(1);
    expect(factorPosition(5)).toBe(1);
    expect(factorPosition(0)).toBe(0);
    expect(factorPosition(0.95)).toBeCloseTo(0.5);
  });
});
