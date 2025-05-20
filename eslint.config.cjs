const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const sonar = require('eslint-plugin-sonarjs');
const eslintPluginPrettier = require('eslint-plugin-prettier');

module.exports = [
  {
    files: ['**/*.{ts,js}'],
    ignores: ['eslint.config.cjs', 'dist/**', 'node_modules/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.build.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs: sonar,
      prettier: eslintPluginPrettier,
    },
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
          selector: 'variable',
          format: ['PascalCase', 'UPPER_CASE'],
          types: ['boolean'],
          prefix: ['is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'can', 'should'],
        },
        {
          selector: 'variableLike',
          format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase', 'UPPER_CASE'],
        },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
    settings: {},
  },
];
