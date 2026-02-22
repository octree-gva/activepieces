/* eslint-disable */
export default {
  displayName: 'pieces-state-store',
  preset: '../../../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../../coverage/packages/pieces/community/state-store',
  transformIgnorePatterns: [
    'node_modules/(?!(superjson|copy-anything|is-what)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^superjson$': '<rootDir>/../../../../node_modules/superjson/dist/index.js',
  },
};
