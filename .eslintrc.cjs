/**
 * ESLint racine du mono-repo MHA · Bureau de Suivi
 * Regles transverses : camelCase strict, pas d'alert(), pas de console.log en prod.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  rules: {
    // Convention de nommage stricte : camelCase partout
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'default', format: ['camelCase'] },
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
      { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['camelCase', 'PascalCase'] },
      { selector: 'property', format: null }, // OK pour les payloads API (deja en camelCase mais autorise des cles libres)
      { selector: 'objectLiteralProperty', format: null },
      { selector: 'import', format: ['camelCase', 'PascalCase'] },
    ],

    // Interdiction de alert / confirm / prompt — utiliser les composants toast/modal
    'no-alert': 'error',

    // Pas de console.log en prod (warn/error/info OK pour debug controle)
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // Imports
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'off',
  },
  settings: {
    'import/resolver': {
      typescript: { project: ['./backend/tsconfig.json', './frontend/tsconfig.json', './shared/tsconfig.json'] },
      node: true,
    },
  },
  overrides: [
    {
      files: ['frontend/**/*.{ts,tsx}'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: { react: { version: 'detect' } },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'scripts/**/*.{ts,js}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', 'mockups/', '*.config.js', '*.config.ts'],
};
