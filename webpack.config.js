module.exports = {
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  target: 'web',
  context: '/app',
  stats: {
    children: false,
    entrypoints: false,
    modules: false,
  },
  node: {
    Buffer: false,
    fs: 'empty',
    tls: 'empty',
  },
  output: {
    path: '/app/.build/',
    publicPath: '/',
    filename: 'assets/[name].js',
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: [
      '.web.jsx',
      '.web.js',
      '.wasm',
      '.mjs',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  devServer: {
    port: 5000,
    hot: true,
    historyApiFallback: true,
    overlay: true,
    stats: {
      all: false,
      errors: true,
      timings: true,
      warnings: true,
    },
    open: false,
    proxy: {
      '/api': {
        changeOrigin: true,
        headers: {
          referer: 'https://treeherder.mozilla.org/webpack-dev-server',
        },
        target: 'https://treeherder.mozilla.org',
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
    watchOptions: {
      poll: 1000,
      ignored: /node_modules/,
    },
  },
  module: {
    rules: [
      /* neutrino.config.module.rule('html') */
      {
        test: /\.html$/,
        use: [
          /* neutrino.config.module.rule('html').use('html') */
          {
            loader: '/app/node_modules/html-loader/index.js',
            options: {
              attrs: ['img:src', 'link:href'],
            },
          },
        ],
      },
      /* neutrino.config.module.rule('compile') */
      {
        test: /\.(mjs|jsx|js)$/,
        include: ['/app/ui/', '/app/tests/ui/'],
        use: [
          /* neutrino.config.module.rule('compile').use('babel') */
          {
            loader: '/app/node_modules/babel-loader/lib/index.js',
            options: {
              cacheDirectory: true,
              babelrc: false,
              configFile: false,
              presets: [
                [
                  '/app/node_modules/@babel/preset-env/lib/index.js',
                  {
                    debug: false,
                    useBuiltIns: false,
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
                  '/app/node_modules/@babel/preset-react/lib/index.js',
                  {
                    development: true,
                    useSpread: true,
                  },
                ],
              ],
              plugins: [
                '/app/node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js',
                '/app/node_modules/react-hot-loader/babel.js',
                [
                  '/app/node_modules/@babel/plugin-proposal-class-properties/lib/index.js',
                  {
                    loose: true,
                  },
                ],
              ],
            },
          },
        ],
      },
      /* neutrino.config.module.rule('style') */
      {
        oneOf: [
          /* neutrino.config.module.rule('style').oneOf('normal') */
          {
            test: /\.css$/,
            use: [
              /* neutrino.config.module.rule('style').oneOf('normal').use('style') */
              {
                loader: '/app/node_modules/style-loader/dist/cjs.js',
              },
              /* neutrino.config.module.rule('style').oneOf('normal').use('css') */
              {
                loader: '/app/node_modules/css-loader/dist/cjs.js',
                options: {
                  importLoaders: 0,
                },
              },
            ],
          },
        ],
      },
      /* neutrino.config.module.rule('font') */
      {
        test: /\.(eot|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          /* neutrino.config.module.rule('font').use('file') */
          {
            loader: '/app/node_modules/file-loader/dist/cjs.js',
            options: {
              name: 'assets/[name].[ext]',
            },
          },
        ],
      },
      /* neutrino.config.module.rule('image') */
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          /* neutrino.config.module.rule('image').use('url') */
          {
            loader: '/app/node_modules/url-loader/dist/cjs.js',
            options: {
              limit: 8192,
              name: 'assets/[name].[ext]',
            },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: false,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: Infinity,
      name: true,
    },
    runtimeChunk: 'single',
  },
  plugins: [
    /* neutrino.config.plugin('html-index') */
    new (require('/app/node_modules/html-webpack-plugin/index.js'))({
      template: 'ui/index.html',
      appMountId: 'root',
      lang: 'en',
      meta: false,
      filename: 'index.html',
      chunks: ['index'],
    }),
    /* neutrino.config.plugin('hot') */
    new (require('/app/node_modules/webpack/lib/HotModuleReplacementPlugin.js'))(),
    /* neutrino.config.plugin('copy') */
    new (require('/app/node_modules/copy-webpack-plugin/dist/cjs.js'))(
      ['ui/contribute.json', 'ui/revision.txt', 'ui/robots.txt'],
      {
        logLevel: 'warn',
      },
    ),
    /* neutrino.config.plugin('provide') */
    new (require('/app/node_modules/webpack/lib/ProvidePlugin.js'))({
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
    }),
  ],
  entry: {
    index: ['/app/ui/index'],
  },
};
