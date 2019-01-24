// `use strict` is still necessary here since this file is not treated as a module.
'use strict'; // eslint-disable-line strict, lines-around-directive

const BACKEND = process.env.BACKEND || 'https://treeherder.mozilla.org';

module.exports = {
  options: {
    source: 'ui/',
    mains: {
      index: {
        entry: 'job-view/index.jsx',
        favicon: 'ui/img/tree_open.png',
        title: 'Treeherder',
      },
      logviewer: {
        entry: 'logviewer/index.jsx',
        favicon: 'ui/img/logviewerIcon.png',
        title: 'Treeherder Logviewer',
      },
      userguide: {
        entry: 'userguide/index.jsx',
        favicon: 'ui/img/tree_open.png',
        title: 'Treeherder User Guide',
      },
      login: {
        entry: 'login-callback/index.jsx',
        title: 'Treeherder Login',
      },
      testview: {
        entry: 'test-view/index.jsx',
        title: 'Treeherder Test View',
      },
      pushhealth: {
        entry: 'push-health/index.jsx',
        title: 'Push Health',
      },
      perf: {
        entry: 'entry-perf.js',
        template: 'ui/perf.html',
      },
      'intermittent-failures': {
        entry: 'intermittent-failures/index.jsx',
        favicon: 'ui/img/tree_open.png',
        title: 'Intermittent Failures View',
      },
    },
    output: '.build/',
    tests: 'tests/ui/',
  },
  use: [
    process.env.NODE_ENV === 'development' && [
      '@neutrinojs/eslint',
      {
        eslint: {
          // We manage our lint config in .eslintrc.js instead of here.
          useEslintrc: true,
        },
      },
    ],
    [
      '@neutrinojs/react',
      {
        devServer: {
          historyApiFallback: false,
          open: !process.env.MOZ_HEADLESS,
          proxy: {
            // Proxy any paths not recognised by webpack to the specified backend.
            '*': {
              changeOrigin: true,
              headers: {
                // Prevent Django CSRF errors, whilst still making it clear
                // that the requests were from local development.
                referer: `${BACKEND}/webpack-dev-server`,
              },
              target: BACKEND,
              onProxyRes: proxyRes => {
                // Strip the cookie `secure` attribute, otherwise production's cookies
                // will be rejected by the browser when using non-HTTPS localhost:
                // https://github.com/nodejitsu/node-http-proxy/pull/1166
                const removeSecure = str => str.replace(/; secure/i, '');
                const cookieHeader = proxyRes.headers['set-cookie'];
                if (cookieHeader) {
                  proxyRes.headers['set-cookie'] = Array.isArray(cookieHeader)
                    ? cookieHeader.map(removeSecure)
                    : removeSecure(cookieHeader);
                }
              },
            },
          },
          // Inside Vagrant filesystem watching has to be performed using polling mode,
          // since inotify doesn't work with Virtualbox shared folders.
          watchOptions: process.env.USE_WATCH_POLLING && {
            // Poll only once a second and ignore the node_modules folder to keep CPU usage down.
            poll: 1000,
            ignored: /node_modules/,
          },
        },
        devtool: {
          // Enable source maps for `yarn build` too (but not on CI, since it doubles build times).
          production: process.env.CI ? false : 'source-map',
        },
        html: {
          // Disable the default viewport meta tag, since Treeherder doesn't work well at
          // small viewport sizes, so shouldn't use `width=device-width` (see bug 1505417).
          meta: false,
        },
        style: {
          // Disable Neutrino's CSS modules support, since we don't use it.
          modules: false,
        },
        targets: {
          browsers: [
            'last 1 Chrome versions',
            'last 1 Edge versions',
            'last 1 Firefox versions',
            'last 1 Safari versions',
          ],
        },
      },
    ],
    [
      '@neutrinojs/copy',
      {
        patterns: ['ui/contribute.json', 'ui/revision.txt', 'ui/robots.txt'],
      },
    ],
    process.env.NODE_ENV === 'test' && '@neutrinojs/jest',
    neutrino => {
      neutrino.config
        .plugin('provide')
        .use(require.resolve('webpack/lib/ProvidePlugin'), [
          {
            // Required since AngularJS and jquery.flot don't import jQuery themselves.
            jQuery: 'jquery',
            'window.jQuery': 'jquery',
          },
        ]);

      if (process.env.NODE_ENV === 'production') {
        // Fail the build if these file size thresholds (in bytes) are exceeded,
        // to help prevent unknowingly regressing the bundle size (bug 1384255).
        neutrino.config.performance
          .hints('error')
          .maxAssetSize(2 * 1024 * 1024)
          .maxEntrypointSize(1.72 * 1024 * 1024);
      }
    },
  ],
};
