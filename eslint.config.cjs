const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const sonar = require('eslint-plugin-sonarjs');
const prettier = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['jest.config.ts', '*.config.ts', '*.config.cjs'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },
      globals: globals.node,
    },
    plugins: { '@typescript-eslint': tseslint, sonarjs: sonar, prettier },
    rules: {
      quotes: ['warn', 'single', { allowTemplateLiterals: true }],
      'object-shorthand': ['warn', 'always'],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
      globals: { ...globals.node, ...globals.jest },
    },
    plugins: { '@typescript-eslint': tseslint, sonarjs: sonar, prettier },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-restricted-imports': ['warn', { patterns: ['../*'] }],
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-useless-catch': 'warn',
      'sonarjs/no-gratuitous-expressions': 'warn',
      'sonarjs/no-ignored-return': 'error',
      'sonarjs/prefer-immediate-return': 'off',
      'sonarjs/prefer-single-boolean-return': 'off',
      'sonarjs/no-identical-functions': 'warn',

      quotes: ['warn', 'single', { allowTemplateLiterals: true }],
      'object-shorthand': ['warn', 'always'],

      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },

        { blankLine: 'always', prev: '*', next: ['const', 'let', 'var', 'export'] },
        { blankLine: 'always', prev: ['const', 'let', 'var', 'export'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var', 'export'], next: ['const', 'let', 'var', 'export'] },

        { blankLine: 'always', prev: '*', next: ['if', 'class', 'for', 'do', 'while', 'switch', 'try'] },
        { blankLine: 'always', prev: ['if', 'class', 'for', 'do', 'while', 'switch', 'try'], next: '*' },

        { blankLine: 'always', prev: '*', next: 'return' },
      ],

      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'parameter',
          modifiers: ['unused'],
          format: null,
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: null,
          filter: { regex: '^_+$', match: true },
        },
        {
          selector: 'variable',
          format: ['PascalCase', 'UPPER_CASE'],
          types: ['boolean'],
          prefix: ['is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'can', 'should', 'got'],
        },
        { selector: 'variableLike', format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
      ],

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  {
    files: ['**/*.js'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' },
      globals: globals.node,
    },
    plugins: { sonarjs: sonar, prettier },
    rules: {
      quotes: ['warn', 'single', { allowTemplateLiterals: true }],
      'object-shorthand': ['warn', 'always'],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
