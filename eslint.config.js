import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';
// import pluginTailwindcss from 'eslint-plugin-tailwindcss';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...ts.configs.strict, // Add strict config for better TypeScript practices
  ...ts.configs.stylistic, // Add stylistic config for consistency
  ...svelte.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Keep your existing rule but be more specific
      'no-undef': 'off', // Necessary for Svelte compiler globals

      // Professional TypeScript/JavaScript rules (no type info required)
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Use TypeScript version instead
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Basic TypeScript rules (no type info required)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      // Code quality rules
      'object-shorthand': 'error',
      'prefer-template': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
    },
  },
  {
    // TypeScript files with type checking (excluding config files)
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['*.config.*'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Enhanced TypeScript rules that require type information
      // '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },
  {
    // TypeScript files with type checking (excluding config files)
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
    rules: {
      // Enhanced TypeScript rules that require type information
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Svelte-specific rules
      'svelte/no-at-debug-tags': 'warn',
      'svelte/no-reactive-functions': 'error',
      'svelte/no-reactive-literals': 'error',
      'svelte/prefer-class-directive': 'error',
      'svelte/prefer-style-directive': 'error',
      'svelte/shorthand-attribute': 'error',
      'svelte/shorthand-directive': 'error',
      'svelte/spaced-html-comment': 'error',

      // Allow console in Svelte files for debugging
      'no-console': 'off',
    },
  },
  {
    // Configuration for test files (if you have them)
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  }
  // {
  //   plugins: {
  //     tailwindcss: true,
  //   },
  //   rules: {
  //     'tailwindcss/classnames-order': 'off',
  //     'tailwindcss/no-custom-classname': 'warn',
  //     'tailwindcss/no-contradicting-classname': 'error',
  //   },
  // }
);
