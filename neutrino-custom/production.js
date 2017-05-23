'use strict';
const { DefinePlugin } = require('webpack');
const copy = require('neutrino-middleware-copy');

module.exports = neutrino => {
    neutrino.config
        .plugin('minify')
        // prevents some minification errors
            .tap(() => [{ evaluate: false }]).end()
        .plugin('define')
        // Define the service domain globally for the thServiceDomain provider:
            .use(DefinePlugin, [{ SERVICE_DOMAIN: JSON.stringify(process.env.SERVICE_DOMAIN) }]);

    // The copy plugin is overwritten and not injected so that when this preset is
    // imported in ./local-watch.js and run via `neutrino start`, it is still included
    // in the config (it is only applied in !development by default):
    neutrino.use(copy, {
        patterns: [
            { context: neutrino.options.source, from: '**' },
            { from: './contribute.json', to: 'contribute.json' }
        ],
        options: {
            ignore: ['*.js', '*.jsx', '*.css', '*.html', '*.tmpl', '*.eot', '*.otf', '*.ttf', '*.woff', '*.woff2']
        }
    });
};
