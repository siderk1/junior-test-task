/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    moduleFileExtensions: ['ts', 'js'],
    testMatch: ['**/*.spec.ts'],
    moduleNameMapper: {
        '^@repo/(.*)$': '<rootDir>/../../packages/$1/src',
    },
    clearMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.module.ts',
        '!src/main.ts',
    ],
    verbose: true
};
