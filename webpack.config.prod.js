module.exports = {
  mode: 'production',
  devtool: 'source-map',
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
    filename: 'assets/[name].[contenthash:8].js',
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
                    development: false,
                    useSpread: true,
                  },
                ],
              ],
              plugins: [
                '/app/node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js',
                '/app/node_modules/react-hot-loader/babel.js',
                [
                  '/app/node_modules/babel-plugin-transform-react-remove-prop-types/lib/index.js',
                  {
                    removeImport: true,
                  },
                ],
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
              /* neutrino.config.module.rule('style').oneOf('normal').use('extract') */
              {
                loader:
                  '/app/node_modules/mini-css-extract-plugin/dist/loader.js',
                options: {
                  esModule: true,
                },
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
              name: 'assets/[name].[hash:8].[ext]',
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
              name: 'assets/[name].[hash:8].[ext]',
            },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5,
      name: false,
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
    /* neutrino.config.plugin('extract') */
    new (require('/app/node_modules/mini-css-extract-plugin/dist/cjs.js'))({
      filename: 'assets/[name].[contenthash:8].css',
    }),
    /* neutrino.config.plugin('clean') */
    new (require('/app/node_modules/clean-webpack-plugin/dist/clean-webpack-plugin.js'))(
      {
        verbose: false,
      },
    ),
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
  performance: {
    hints: 'error',
    maxAssetSize: 1782579.2,
    maxEntrypointSize: 2621440,
  },
  entry: {
    index: ['/app/ui/index'],
  },
};
