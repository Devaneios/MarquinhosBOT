import js from '@eslint/js';
import { rules } from '@marquinhos/eslint-config/rules';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  // Ignore patterns first
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '*.js.map',
      '*.d.ts',
      'coverage/**',
      '.nyc_output/**',
      'build/**',
      'tmp/**',
      'temp/**',
      'src/resources/**',
    ],
  },
  // Configuration for TypeScript files
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'writable',
        global: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        NodeJS: true,
        // Bun runtime globals
        Bun: 'readonly',
        // Fetch API globals (Node.js 18+)
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      // prettier: prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...rules,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@marquinhos/database/client',
              message: 'Inject DB from database/database.tokens instead.',
              allowTypeImports: true,
            },
            {
              name: 'express',
              message: 'Keep Express at the HTTP boundary and use type imports.',
              allowTypeImports: true,
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read environment values through AppConfig.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='forwardRef']",
          message: 'Module cycles must be removed instead of using forwardRef.',
        },
        {
          selector: "CallExpression[callee.name='forwardRef']",
          message: 'Module cycles must be removed instead of using forwardRef.',
        },
        {
          selector: "MemberExpression[object.name='Scope'][property.name='REQUEST']",
          message: 'Use the default singleton provider scope.',
        },
        {
          selector: "MemberExpression[object.name='Scope'][property.name='TRANSIENT']",
          message: 'Use the default singleton provider scope.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/modules/wordle/migration/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@marquinhos/database/client',
              message: 'Inject DB from database/database.tokens instead.',
              allowTypeImports: true,
            },
            {
              name: 'express',
              message: 'Keep Express at the HTTP boundary and use type imports.',
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: [
                '**/wordle/migration/**',
                'modules/wordle/migration/**',
                '../migration/**',
                './migration/**',
              ],
              message:
                'Runtime modules must not depend on Wordle cutover or migration implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/config/**/*.{ts,tsx}', 'src/common/logging/logger.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['src/database/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'express',
              message: 'Keep Express at the HTTP boundary and use type imports.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    ignores: ['src/modules/**/*.module.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportSpecifier[imported.name='forwardRef']",
          message: 'Module cycles must be removed instead of using forwardRef.',
        },
        {
          selector: "CallExpression[callee.name='forwardRef']",
          message: 'Module cycles must be removed instead of using forwardRef.',
        },
        {
          selector: "MemberExpression[object.name='Scope'][property.name='REQUEST']",
          message: 'Use the default singleton provider scope.',
        },
        {
          selector: "MemberExpression[object.name='Scope'][property.name='TRANSIENT']",
          message: 'Use the default singleton provider scope.',
        },
        {
          selector:
            'NewExpression[callee.name=/Service$/]:not([callee.name="TurndownService"])',
          message: 'Resolve feature services through Nest dependency injection.',
        },
      ],
    },
  },
];
