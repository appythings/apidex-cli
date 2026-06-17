module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    '<rootDir>/src/index.js',
    '<rootDir>/src/lib/formatAxiosError.js',
    '<rootDir>/src/lib/jwt.js',
    '<rootDir>/src/commands/**/*.js',
    '<rootDir>/src/devportal/portal.js',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/index.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/lib/formatAxiosError.js': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
    './src/lib/jwt.js': {
      branches: 90,
      functions: 100,
      lines: 90,
      statements: 90,
    },
    './src/devportal/portal.js': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
