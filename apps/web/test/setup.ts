import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion';
import { afterEach, vi } from 'vitest';

// No animations in a DOM without a compositor; the states are what is tested.
MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Motion reads matchMedia for reduced motion
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
}
