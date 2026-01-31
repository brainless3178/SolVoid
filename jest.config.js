/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts', '**/*.test.js'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverageFrom: [
        'sdk/**/*.ts',
        'cli/**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 15,
            statements: 15
        }
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tests/tsconfig.json',
            diagnostics: {
                ignoreCodes: [151001]
            }
        }],
        '^.+\\.jsx?$': ['ts-jest', {
            tsconfig: 'tests/tsconfig.json',
            useESM: true,
            diagnostics: {
                ignoreCodes: [151001]
            }
        }]
    },
    testTimeout: 10000,
    transformIgnorePatterns: [
        // Allow transformation of ESM modules
        "node_modules/(?!(p-retry|@coral-xyz/borsh|@solana|fetch-retry|is-network-error|chai)/)"
    ],
    verbose: true,
    clearMocks: true,
    restoreMocks: true
};
