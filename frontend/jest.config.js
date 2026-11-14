module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/selenium/**/*.test.js'],
    testTimeout: 120000, // 2 минуты
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/tests/selenium/setup.js']
};
