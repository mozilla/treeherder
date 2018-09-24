// `use strict` is still necessary here since this file is not treated as a module.
'use strict'; // eslint-disable-line strict, lines-around-directive

const merge = require('deepmerge');
const lintBase = require('neutrino-lint-base');
const path = require('path');

const CWD = process.cwd();
const UI = path.join(CWD, 'ui');

module.exports = (neutrino) => {
    lintBase(neutrino);
    neutrino.config.module
        .rule('lint')
        .include(UI)
        .test(/\.jsx?$/)
        .loader('eslint', props => merge(props, {
            options: {
                plugins: ['react'],
                envs: ['browser', 'es6', 'commonjs', 'jasmine'],
                baseConfig: {
                    extends: ['airbnb'],
                },
                rules: {
                    // TODO: Fix & remove these deviations from AirBnB style (bug 1183749).
                    camelcase: 'off',
                    'class-methods-use-this': 'off',
                    'consistent-return': 'off',
                    'default-case': 'off',
                    'func-names': 'off',
                    // Indentation is disabled pending a switch from 4 to 2 space for JS.
                    indent: 'off',
                    'jsx-a11y/label-has-for': 'off',
                    'jsx-a11y/no-noninteractive-element-interactions': 'off',
                    'jsx-a11y/no-static-element-interactions': 'off',
                    'max-len': 'off',
                    'no-alert': 'off',
                    'no-continue': 'off',
                    'no-loop-func': 'off',
                    'no-mixed-operators': 'off',
                    'no-nested-ternary': 'off',
                    'no-param-reassign': 'off',
                    'no-plusplus': 'off',
                    'no-prototype-builtins': 'off',
                    'no-restricted-syntax': 'off',
                    'no-shadow': 'off',
                    'no-underscore-dangle': 'off',
                    'no-useless-escape': 'off',
                    'object-shorthand': 'off',
                    'padded-blocks': 'off',
                    'prefer-arrow-callback': 'off',
                    'prefer-template': 'off',
                    radix: 'off',
                    'react/forbid-prop-types': 'off',
                    'react/no-multi-comp': 'off',
                    // Backport of:
                    // https://github.com/airbnb/javascript/blob/eslint-config-airbnb-v17.1.0/packages/eslint-config-airbnb/rules/react.js#L230-L272
                    // Remove once we're on eslint-config-airbnb v17.
                    'react/sort-comp': ['error', {
                      order: [
                        'static-methods',
                        'instance-variables',
                        'lifecycle',
                        '/^on.+$/',
                        'getters',
                        'setters',
                        '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
                        'instance-methods',
                        'everything-else',
                        'rendering',
                      ],
                      groups: {
                        lifecycle: [
                          'displayName',
                          'propTypes',
                          'contextTypes',
                          'childContextTypes',
                          'mixins',
                          'statics',
                          'defaultProps',
                          'constructor',
                          'getDefaultProps',
                          'getInitialState',
                          'state',
                          'getChildContext',
                          'componentWillMount',
                          'componentDidMount',
                          'componentWillReceiveProps',
                          'shouldComponentUpdate',
                          'componentWillUpdate',
                          'componentDidUpdate',
                          'componentWillUnmount',
                        ],
                        rendering: [
                          '/^render.+$/',
                          'render',
                        ],
                      },
                    }],
                },
                // Remove once we're on newer ESLint that has the updated browser globals list.
                globals: ['AbortController'],
            },
        }));
};
