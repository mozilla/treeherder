'use strict';
const { DefinePlugin } = require('webpack');

module.exports = neutrino => {
    // The service domain is used to determine whether login is available in the auth component.
    // Set the service domain to production if no environment value was provided, since
    // webpack-dev-server doesn't serve data from the vagrant machine.
    const serviceDomain = process.env.SERVICE_DOMAIN || 'https://treeherder.mozilla.org';

    // Set service domain so that ui/js/config can use it:
    neutrino.config
        .plugin('define')
            .use(DefinePlugin, [{ SERVICE_DOMAIN: JSON.stringify(serviceDomain) }]).end()
        // Set up the dev server with an api proxy to the service domain:
        .devServer
            .proxy({
                '/api/*': {
                    target: serviceDomain,
                    changeOrigin: true
                }
            });
};
