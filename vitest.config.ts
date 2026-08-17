import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
