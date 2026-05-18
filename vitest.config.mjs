// @ts-check
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    exclude: ['tests/e2e/**'],
    environment: 'node', // overridden to 'jsdom' per-file via /** @vitest-environment jsdom */
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/relations/**'],
      exclude: ['src/**/*.test.js'],
      reporter: ['text', 'html'],
    },
  },
});
