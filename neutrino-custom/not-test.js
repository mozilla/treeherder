'use strict';
const Md5HashPlugin = require('webpack-md5-hash');

module.exports = neutrino => neutrino.config
    // Include files from node_modules in the separate, more-cacheable vendor chunk:
    .entry('vendor')
        .merge([
            'angular', 'angular-cookies', 'angular-local-storage', 'angular-resource',
            'angular-route', 'angular-sanitize', 'angular-toarrayfilter', 'angular-ui-bootstrap',
            'angular-ui-router', 'bootstrap/dist/js/bootstrap', 'hawk', 'jquery', 'jquery.scrollto',
            'js-yaml', 'mousetrap', 'react', 'react-dom', 'taskcluster-client'
        ])
        .end()
    // Ensure chunkhashes for unchanged chunks don't change -- this allows the bundled vendor
    // file to keep its hash and stay cached in the user's browser when it hasn't been updated.
    .output
        .chunkFilename('[chunkhash].[id].chunk.js').end()
    .plugin('hash')
        .use(Md5HashPlugin);
