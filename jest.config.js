module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    '<rootDir>/src/lib/formatAxiosError.js',
    '<rootDir>/src/commands/**/*.js',
    '<rootDir>/src/devportal/portal.js',
  ],
  coverageThreshold: {
    global: {
      branches: 78,
      functions: 78,
      lines: 80,
      statements: 80,
    },
    './src/lib/formatAxiosError.js': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
  },
};
