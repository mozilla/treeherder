const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const HotModuleReplacementPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { ProvidePlugin } = require('webpack');

module.exports = {
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  target: 'web',
  context: path.resolve(__dirname),
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
    path: path.resolve(__dirname, '.build'),
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
            loader: 'html-loader/index.js',
            options: {
              attrs: ['img:src', 'link:href'],
            },
          },
        ],
      },
      /* neutrino.config.module.rule('compile') */
      {
        test: /\.(mjs|jsx|js)$/,
        include: [
          path.resolve(__dirname, 'ui'),
          path.resolve(__dirname, 'tests/ui'),
        ],
        use: [
          /* neutrino.config.module.rule('compile').use('babel') */
          {
            loader: 'babel-loader',
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
              {
                loader: 'style-loader',
              },
              {
                loader: 'css-loader',
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
          {
            loader: 'file-loader',
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
          {
            loader: 'url-loader',
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
    new HtmlWebpackPlugin({
      template: 'ui/index.html',
      appMountId: 'root',
      lang: 'en',
      meta: false,
      filename: 'index.html',
      chunks: ['index'],
    }),
    new HotModuleReplacementPlugin(),
    new CopyWebpackPlugin(
      ['ui/contribute.json', 'ui/revision.txt', 'ui/robots.txt'],
      {
        logLevel: 'warn',
      },
    ),
    new ProvidePlugin({
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
    }),
  ],
  entry: {
    index: ['./ui/index'],
  },
};
