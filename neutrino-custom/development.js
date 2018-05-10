'use strict';
const basePreset = require('./base');
const UI = require('./base').UI;

// Default to the production backend (is overridden to localhost when using start:local)
const BACKEND_DOMAIN = process.env.BACKEND_DOMAIN || 'https://treeherder.mozilla.org';

module.exports = neutrino => {
    basePreset(neutrino);

    // Make the dev server proxy any paths not recognised by webpack to the specified backend.
    neutrino.config.devServer
        .contentBase(UI)
        .set('proxy', {
            '*': {
                target: BACKEND_DOMAIN,
                changeOrigin: true,
                onProxyReq: (proxyReq) => {
                  // Adjust the referrer to keep Django's CSRF protection happy, whilst
                  // still making it clear that the requests were from local development.
                  proxyReq.setHeader('referer', `${BACKEND_DOMAIN}/webpack-dev-server`);
                },
                onProxyRes: (proxyRes) => {
                  // Strip the cookie `secure` attribute, otherwise prod cookies
                  // will be rejected by the browser when using non-HTTPS localhost:
                  // https://github.com/nodejitsu/node-http-proxy/pull/1166
                  const removeSecure = str => str.replace(/; secure/i, '');
                  const setCookie = proxyRes.headers['set-cookie'];
                  if (setCookie) {
                    const result = Array.isArray(setCookie)
                      ? setCookie.map(removeSecure)
                      : removeSecure(setCookie);
                    proxyRes.headers['set-cookie'] = result;
                  }
                }
            }
        });
};
