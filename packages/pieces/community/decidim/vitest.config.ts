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
      thresholds: {
        'src/lib/domains/blogs/blog-posts.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/blogs/blog-posts.helpers.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/organizations/organizations.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/proposals/proposals.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/proposals/proposals.helpers.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/proposals/draft-proposals.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/proposals/draft-proposals.helpers.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/users/search-users.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
        'src/lib/domains/users/get-token.ts': {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 90,
        },
      },
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
