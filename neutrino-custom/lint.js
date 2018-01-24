'use strict';

const merge = require('deepmerge');
const lintBase = require('neutrino-lint-base');
const path = require('path');

const CWD = process.cwd();
const UI = path.join(CWD, 'ui');

module.exports = neutrino => {
    lintBase(neutrino);
    neutrino.config.module
        .rule('lint')
        .include(UI)
        .test(/\.jsx?$/)
        .loader('eslint', props => merge(props, {
            options: {
                plugins: ['react'],
                envs: ['browser', 'es6', 'commonjs'],
                baseConfig: {
                    extends: ['airbnb']
                },
                rules: {
                    // TODO: Fix & remove these deviations from AirBnB style (bug 1183749).
                    'array-bracket-spacing': 'off',
                    'block-scoped-var': 'off',
                    'camelcase': 'off',
                    'class-methods-use-this': 'off',
                    'comma-dangle': 'off',
                    'consistent-return': 'off',
                    'default-case': 'off',
                    'func-names': 'off',
                    'global-require': 'off',
                    'import/first': 'off',
                    'import/no-named-as-default': 'off',
                    'import/prefer-default-export': 'off',
                    // Indentation is disabled pending a switch from 4 to 2 space for JS.
                    'indent': 'off',
                    'jsx-a11y/label-has-for': 'off',
                    'jsx-a11y/no-noninteractive-element-interactions': 'off',
                    'jsx-a11y/no-static-element-interactions': 'off',
                    'lines-around-directive': 'off',
                    'max-len': 'off',
                    'no-alert': 'off',
                    'no-continue': 'off',
                    'no-extra-semi': 'off',
                    'no-loop-func': 'off',
                    'no-mixed-operators': 'off',
                    'no-multi-assign': 'off',
                    'no-nested-ternary': 'off',
                    'no-param-reassign': 'off',
                    'no-plusplus': 'off',
                    'no-prototype-builtins': 'off',
                    'no-redeclare': 'off',
                    'no-restricted-properties': 'off',
                    'no-restricted-syntax': 'off',
                    'no-shadow': 'off',
                    'no-underscore-dangle': 'off',
                    'no-use-before-define': 'off',
                    'no-useless-escape': 'off',
                    'no-var': 'off',
                    'object-property-newline': 'off',
                    'object-shorthand': 'off',
                    'one-var': 'off',
                    'one-var-declaration-per-line': 'off',
                    'padded-blocks': 'off',
                    'prefer-arrow-callback': 'off',
                    'prefer-const': 'off',
                    'prefer-rest-params': 'off',
                    'prefer-spread': 'off',
                    'prefer-template': 'off',
                    'quotes': 'off',
                    'radix': 'off',
                    'react/forbid-prop-types': 'off',
                    'react/jsx-first-prop-new-line': 'off',
                    'react/jsx-indent': 'off',
                    'react/jsx-indent-props': 'off',
                    'react/jsx-max-props-per-line': 'off',
                    'react/no-array-index-key': 'off',
                    'react/no-danger': 'off',
                    'react/no-multi-comp': 'off',
                    'react/prefer-stateless-function': 'off',
                    'react/prop-types': 'off',
                    'react/require-default-props': 'off',
                    'space-infix-ops': 'off',
                    'spaced-comment': 'off',
                    'strict': 'off',
                    'vars-on-top': 'off',
                },
                globals: [
                    '$',
                    '_',
                    'angular',
                    'failureViewerApp',
                    'jQuery',
                    'logViewerApp',
                    'Mousetrap',
                    'perf',
                    'React',
                    'SERVICE_DOMAIN',
                    'treeherder',
                    'treeherderApp',
                    'userguideApp',
                ]
            }
        }));
};
