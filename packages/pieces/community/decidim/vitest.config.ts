import path from 'path';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(__dirname, '../../../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['scripts/**', 'src/types.ts', 'src/lib/types/**'],
    },
  },
  resolve: {
    alias: {
      '@activepieces/pieces-framework': path.resolve(
        repoRoot,
        'packages/pieces/framework/src/index.ts'
      ),
      '@activepieces/pieces-common': path.resolve(repoRoot, 'packages/pieces/common/src/index.ts'),
    },
  },
});
