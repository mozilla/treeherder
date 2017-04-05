'use strict';
const eslint = require('neutrino-middleware-eslint');

module.exports = neutrino => neutrino.use(eslint, {
    include: [neutrino.options.source],
    eslint: {
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
            'indent': ['error', 4, { 'SwitchCase': 1 }],
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
            'no-unexpected-multiline': 'error',
            'no-unused-expressions': 'error',
            'no-useless-call': 'error',
            'no-void': 'error',
            'no-with': 'error',
            'semi': 'error',
            'strict': ['error', 'global'],
            'yoda': 'error'
        },
        globals: ['angular', '$', '_', 'treeherder', 'jsyaml', 'perf',
            'treeherderApp', 'failureViewerApp', 'logViewerApp',
            'userguideApp', 'admin', 'Mousetrap', 'jQuery', 'React',
            'hawk', 'jsonSchemaDefaults'
        ]
    }
});
