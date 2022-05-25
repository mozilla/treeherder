const path = require('path');

const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HotModuleReplacementPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { ProvidePlugin } = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const commonConfig = {
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
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader/index.js',
            options: {
              attrs: ['img:src', 'link:href'],
            },
          },
        ],
      },
      {
        test: /\.(mjs|jsx|js)$/,
        include: [
          path.resolve(__dirname, 'ui'),
          path.resolve(__dirname, 'tests/ui'),
        ],
        use: [
          {
            loader: 'babel-loader',
          },
        ],
      },
    ],
  },
  plugins: [
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

const developmentConfig = {
  mode: 'development',

  devtool: 'cheap-module-eval-source-map',

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

  output: {
    filename: 'assets/[name].js',
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
    new HotModuleReplacementPlugin({
      template: 'ui/index.html',
      lang: 'en',
      filename: 'index.html',
    }),
  ],

  module: {
    rules: [
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
};

const productionConfig = {
  mode: 'production',
  devtool: 'source-map',

  output: {
    filename: 'assets/[name].[contenthash:8].js',
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

  performance: {
    hints: 'error',
    maxAssetSize: 1782579.2,
    maxEntrypointSize: 2621440,
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
    new MiniCssExtractPlugin({
      filename: 'assets/[name].[contenthash:8].css',
    }),
    new CleanWebpackPlugin({
      verbose: false,
    }),
  ],

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 0,
            },
          },
        ],
      },
      {
        test: /\.(eot|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'assets/[name].[hash:8].[ext]',
            },
          },
        ],
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              name: 'assets/[name].[hash:8].[ext]',
            },
          },
        ],
      },
    ],
  },
};

module.exports = (env, args) => {
  switch (args.mode) {
    case 'development':
      return merge(commonConfig, developmentConfig);
    case 'production':
      return merge(commonConfig, productionConfig);
    default:
      throw new Error('No matching configuration was found!');
  }
};
