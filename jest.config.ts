export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.(t|j)s', '!**/*.model.(t|j)s', '!**/*.dto.(t|j)s', '!main.(t|j)s'],
  coverageThreshold: { global: { statements: 81, branches: 81, functions: 81, lines: 81 } },
  coverageReporters: ['text', 'json', 'json-summary', 'html', 'lcov'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
};
