import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: '<rootDir>/test/helpers/tz-environment.cjs',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};

export default config;
