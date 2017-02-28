'use strict';

const webpack = require('webpack');
const productionPreset = require('./production');

// Taskcluster login POSTs in treeherder require that the UI is served from the same
// origin as the backend. To allow for logins in watched, unminified mode, here we
// build a webpack watcher that recompiles sources to dist/ on change, so that the
// Vagrant box may serve them. This approach is slower than using the dev server, but
// it may become unnecessary if Bug 1317752 (Enable logging in with Taskcluster Auth
// cross-domain) is completed.

module.exports = neutrino => {
    // This configuration is based on the production config, but is not minified,
    // since NODE_ENV is not set to development by `neutrino start`.
    productionPreset(neutrino);

    // Removing the dev server configuration puts neutrino into watch mode
    neutrino.config.devServer.clear();

    // Now we must remove some hot-reload settings triggered by the 'development' NODE_ENV
    // Remove hot loader plugin:
    neutrino.config.plugins.delete('hot');

    // Remove hot loader patch from index:
    const protocol = process.env.HTTPS ? 'https' : 'http';
    const host = process.env.HOST || 'localhost';
    const port = parseInt(process.env.PORT) || 5000;
    neutrino.config.entry('index')
        .delete(`webpack-dev-server/client?${protocol}://${host}:${port}/`)
        .delete('webpack/hot/dev-server')
        .delete(require.resolve('react-hot-loader/patch'));

    // Remove hot loader react plugin:
    neutrino.config.module
        .rule('compile')
        .loader('babel', require.resolve('babel-loader'), {
            presets: [require.resolve('babel-preset-react')],
            plugins: [require.resolve('babel-plugin-transform-object-rest-spread')],
            env: null
        });

    // Finally, the service domain should be set:
    neutrino.config
        .plugin('define')
        .use(webpack.DefinePlugin, {
            SERVICE_DOMAIN: JSON.stringify(process.env.SERVICE_DOMAIN)
        });
};
