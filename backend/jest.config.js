module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'models/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    'middlewares/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000,
  forceExit: true,
  verbose: true
};
