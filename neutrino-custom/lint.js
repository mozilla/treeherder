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
                envs: ['browser', 'es6', 'node'],
                parserOptions: {
                    sourceType: 'script',
                    ecmaFeatures: {
                        es6: true,
                        jsx: true,
                        impliedStrict: false
                    }
                },
                extends: 'eslint:recommended',
                rules: {
                    'accessor-pairs': 'error',
                    'comma-style': 'error',
                    'eol-last': 'error',
                    'eqeqeq': 'error',
                    'guard-for-in': 'error',
                    'indent': ['error', 4, {
                        'SwitchCase': 1
                    }],
                    'keyword-spacing': 'error',
                    'linebreak-style': 'error',
                    'new-cap': 'error',
                    'new-parens': 'error',
                    'no-array-constructor': 'error',
                    'no-bitwise': 'error',
                    'no-caller': 'error',
                    'no-div-regex': 'error',
                    'no-else-return': 'error',
                    'no-empty-pattern': 'error',
                    'no-eval': 'error',
                    'no-extend-native': 'error',
                    'no-extra-bind': 'error',
                    'no-floating-decimal': 'error',
                    'no-implied-eval': 'error',
                    'no-iterator': 'error',
                    'no-label-var': 'error',
                    'no-labels': 'error',
                    'no-lone-blocks': 'error',
                    'no-lonely-if': 'error',
                    'no-multi-spaces': 'error',
                    'no-multi-str': 'error',
                    'no-native-reassign': 'error',
                    'no-new': 'error',
                    'no-new-func': 'error',
                    'no-new-object': 'error',
                    'no-new-wrappers': 'error',
                    'no-octal-escape': 'error',
                    'no-proto': 'error',
                    'no-return-assign': 'error',
                    'no-script-url': 'error',
                    'no-self-compare': 'error',
                    'no-sequences': 'error',
                    'no-shadow-restricted-names': 'error',
                    'no-spaced-func': 'error',
                    'no-trailing-spaces': 'error',
                    'no-undef-init': 'error',
                    'no-undef': 'error',
                    'no-unexpected-multiline': 'error',
                    'no-unused-expressions': 'error',
                    'no-unused-vars': 'error',
                    'no-useless-call': 'error',
                    'no-void': 'error',
                    'no-with': 'error',
                    'semi': 'error',
                    'space-before-function-paren': ['error', {
                        anonymous: 'always',
                        named: 'never',
                        asyncArrow: 'always'
                    }],
                    'strict': ['error', 'global'],
                    'yoda': 'error'
                },
                globals: ['angular', '$', '_', 'treeherder', 'perf',
                    'treeherderApp', 'failureViewerApp', 'logViewerApp',
                    'userguideApp', 'admin', 'Mousetrap', 'jQuery', 'React',
                    'hawk', 'jsonSchemaDefaults', 'SERVICE_DOMAIN'
                ]
            }
        }));
};

