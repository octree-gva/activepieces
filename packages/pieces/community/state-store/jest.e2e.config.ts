/* eslint-disable */
export default {
  displayName: 'pieces-state-store-e2e',
  preset: '../../../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.e2e.test.ts'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  transformIgnorePatterns: [
    'node_modules/(?!(superjson|copy-anything|is-what)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^superjson$': '<rootDir>/../../../../node_modules/superjson/dist/index.js',
  },
  testTimeout: 180000,
};
