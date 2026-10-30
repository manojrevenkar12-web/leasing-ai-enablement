import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname, 'server-only': new URL('./test/empty.ts', import.meta.url).pathname } },
  test: { environment: 'happy-dom', include: ['test/**/*.test.{ts,tsx}'], setupFiles: ['test/setup.ts'] },
});
