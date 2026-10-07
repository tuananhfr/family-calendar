import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: '<rootDir>/test/helpers/tz-environment.cjs',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/test/int/**/*.int-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  setupFiles: ['<rootDir>/test/helpers/env.ts'],
  globalSetup: '<rootDir>/test/helpers/global-setup.ts',
  testTimeout: 30000,
};

export default config;
