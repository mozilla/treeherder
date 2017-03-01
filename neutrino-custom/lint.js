'use strict';

const lint = require('neutrino-lint-base');
const path = require('path');

const CWD = process.cwd();
const UI = path.join(CWD, 'ui');

module.exports = neutrino => {
    lint(neutrino);
    neutrino.config.module
        .rule('lint')
        .include(UI)
        .test(/\.jsx?$/)
        .loader('eslint', ({ options }) => {
            options = {
                useEslintrc: true,
                configFile: path.join(CWD, '.eslintrc'),
            };
            return { options };
        });
};
