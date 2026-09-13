import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/matching/**'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
