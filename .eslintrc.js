module.exports = {
  root: true,
  extends: [
    'eslint-config-airbnb',
    // We use Prettier instead of AirBnb for style-related rules (see .prettierrc.js).
    'plugin:prettier/recommended',
    // Disable React-related AirBnB style rules.
    'prettier',
    'plugin:jest/recommended',
    'plugin:jest/style',
  ],
  parser: '@babel/eslint-parser',
  settings: {
    react: {
      version: '18',
    },
  },
  env: {
    browser: true,
  },
  globals: {
    page: true,
    browser: true,
    jestPuppeteer: true,
  },
  rules: {
    'class-methods-use-this': 'off',
    'consistent-return': 'off',
    'default-case': 'off',
    'default-param-last': 'off',
    'import/extensions': 'off',
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
    'react/sort-comp': [0, {}],
    // Override AirBnB's config for this rule to make it more strict.
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/order.md
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
      },
    ],
  },
};
