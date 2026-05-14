module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@soulane/shared$': '<rootDir>/../../packages/sync-core/src/index.ts'
  }
};
