/* eslint-disable import/no-extraneous-dependencies, global-require */

// This is the configuration file for Neutrino, which configures webpack and Jest:
// https://neutrinojs.org

// `use strict` is still necessary here since this file is not treated as a module.
'use strict'; // eslint-disable-line strict, lines-around-directive

const BACKEND = process.env.BACKEND || 'https://treeherder.mozilla.org';

module.exports = {
  options: {
    source: 'ui/',
    mains: {
      index: {
        entry: 'index',
        template: 'ui/index.html',
      },
    },
    output: '.build/',
    tests: 'tests/ui/',
  },
  use: [
    process.env.NODE_ENV === 'development' &&
      require('@neutrinojs/eslint')({
        eslint: {
          // We manage our lint config in .eslintrc.js instead of here.
          useEslintrc: true,
        },
      }),
    require('@neutrinojs/react')({
      devServer: {
        historyApiFallback: true,
        hot: true,
        open: !process.env.IN_DOCKER,
        proxy: {
          // Proxy any paths not recognised by webpack to the specified backend.
          '/api': {
            changeOrigin: true,
            headers: {
              // Prevent Django CSRF errors, whilst still making it clear
              // that the requests were from local development.
              referer: `${BACKEND}/webpack-dev-server`,
            },
            target: BACKEND,
            onProxyRes: (proxyRes) => {
              // Strip the cookie `secure` attribute, otherwise production's cookies
              // will be rejected by the browser when using non-HTTPS localhost:
              // https://github.com/nodejitsu/node-http-proxy/pull/1166
              const removeSecure = (str) => str.replace(/; secure/i, '');
              const cookieHeader = proxyRes.headers['set-cookie'];
              if (cookieHeader) {
                proxyRes.headers['set-cookie'] = Array.isArray(cookieHeader)
                  ? cookieHeader.map(removeSecure)
                  : removeSecure(cookieHeader);
              }
            },
          },
        },
        // Inside Docker filesystem watching has to be performed using polling mode,
        // since inotify doesn't work.
        watchOptions: process.env.IN_DOCKER && {
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
    }),
    require('@neutrinojs/copy')({
      patterns: [
        'ui/contribute.json',
        'ui/revision.txt',
        'ui/robots.txt',
        'mozci_config.toml',
      ],
    }),
    process.env.NODE_ENV === 'test' &&
      require('@neutrinojs/jest')({
        setupFilesAfterEnv: ['<rootDir>/tests/ui/test-setup.js'],
        // For more info, see: https://bugzilla.mozilla.org/show_bug.cgi?id=1523376#c3
        moduleNameMapper: {
          // Hawk's browser and Node APIs differ, and taskcluster-client-web uses APIs that
          // exist only in the browser version. As such we must force Jest (which runs tests
          // under Node, not the browser) to use the browser version of Hawk. See:
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1523376#c6
          '^hawk$': 'hawk/dist/browser.js',
        },
      }),
    (neutrino) => {
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
          .maxAssetSize(1.7 * 1024 * 1024)
          .maxEntrypointSize(2.5 * 1024 * 1024);
      }
    },
  ],
};
