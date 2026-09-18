import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.e2e.test.ts'],
    setupFiles: ['dotenv/config'],
    // Sobem um Chromium por arquivo e conversam com a mesma API: em paralelo
    // um teste arrasta o pátio do outro.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
