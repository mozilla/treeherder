import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    'eslint-config-airbnb',
    'plugin:prettier/recommended',
    'prettier',
    'plugin:jest/recommended',
    'plugin:jest/style',
  ),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        page: true,
        browser: true,
        jestPuppeteer: true,
      },

      parser: babelParser,
    },
    files: ['**/*.js', '**/*.jsx'],
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.json'],
          moduleDirectory: ['node_modules', 'ui'],
        },
      },
    },
    rules: {
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'default-case': 'off',
      'default-param-last': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': [
        'error',
        { ignore: ['^react-resizable-panels$'] },
      ],
      'jsx-a11y/click-events-have-key-events': 'off',
      'no-alert': 'off',
      'no-continue': 'off',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-restricted-syntax': 'off',
      'no-shadow': 'off',
      'no-underscore-dangle': 'off',
      'prefer-promise-reject-errors': 'off',
      'react/destructuring-assignment': 'off',
      'react/function-component-definition': 'off',
      'react/jsx-fragments': 'off',
      'react/jsx-no-constructed-context-values': 'off',
      'react/jsx-no-script-url': 'off',
      'react/jsx-no-useless-fragment': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/no-arrow-function-lifecycle': 'off',
      'react/no-invalid-html-attribute': 'off',
      'react/no-namespace': 'off',
      'react/no-unstable-nested-components': 'off',
      'react/no-unused-class-component-methods': 'off',
      'react/prefer-exact-props': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off', // Allow default parameters instead of defaultProps
      'react/sort-comp': [0, {}],

      'import/order': [
        'error',
        {
          'newlines-between': 'always',
        },
      ],
    },
  },
];
