import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.integration.test.ts'],
    setupFiles: ['dotenv/config'],
    // Os testes de mysql compartilham um banco só e limpam as tabelas entre casos:
    // em paralelo um arquivo apaga as fixtures do outro.
    fileParallelism: false,
  },
});
