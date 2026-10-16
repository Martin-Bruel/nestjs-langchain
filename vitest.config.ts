import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.spec.ts', 'tests/**/*.spec.ts'],
    // `build` only covers `lib/`, and the transform does not check types,
    // so this is what holds `tests/` to the compiler.
    typecheck: { include: ['tests/**/*.test-d.ts'] },
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.spec.ts'],
      reporter: ['text', 'lcov'],
      // Raised by hand, never lowered. See #7.
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
