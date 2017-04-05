'use strict';

// Taskcluster login POSTs in treeherder require that the UI is served from the same
// origin as the backend. To allow for logins in watched, unminified mode, here we
// build a webpack watcher that recompiles sources to dist/ on change, so that the
// Vagrant box may serve them. This approach is slower than using the dev server, but
// it may become unnecessary if Bug 1317752 (Enable logging in with Taskcluster Auth
// cross-domain) is completed.

module.exports = neutrino => {
    const protocol = process.env.HTTPS ? 'https' : 'http';
    const host = process.env.HOST || 'localhost';
    const port = parseInt(process.env.PORT) || 5000;

    neutrino.config
        // Removing the dev server configuration puts neutrino into watch mode
        .devServer.clear().end()
        .plugins
            // Don't minify:
            .delete('minify')
            // Now we must remove some hot-reload settings triggered by the 'development'
            // NODE_ENV variable set by `neutrino start`:
            // Remove hot loader plugin:
            .delete('hot')
            .end()
        // Remove hot loader patch from index:
        .entry('index')
            .delete(`webpack-dev-server/client?${protocol}://${host}:${port}/`)
            .delete('webpack/hot/dev-server')
            .delete(require.resolve('react-hot-loader/patch'))
            .end()
        // Remove hot loader react plugin:
        .module
            .rule('compile')
                .use('babel')
                    .tap(options => {
                        const dev = options.env.development;

                        dev.plugins = dev.plugins
                            .filter(plugin => !plugin.includes('react-hot-loader'));

                        return options;
                    });
};
