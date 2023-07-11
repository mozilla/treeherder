const path = require('path');

const webpack = require('webpack');
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
    fallback: {
      url: require.resolve('url'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      assert: require.resolve('assert'),
      fs: false,
      tls: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(mjs|jsx|js)$/,
        resolve: {
          fullySpecified: false, // disable the behaviour
        },
      },
      {
        test: /\.html$/,
        use: {
          loader: 'html-loader',
          options: {
            sources: {
              list: [
                {
                  tag: 'img',
                  attribute: 'img-src',
                  type: 'src',
                },
                {
                  tag: 'a',
                  attribute: 'href',
                  type: 'src',
                },
              ],
            },
          },
        },
      },
      {
        test: /\.(mjs|jsx|js)$/,
        type: 'javascript/auto',
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
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new CopyWebpackPlugin({
      patterns: ['ui/contribute.json', 'ui/revision.txt', 'ui/robots.txt'],
    }),
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

  devtool: 'eval-cheap-module-source-map',

  devServer: {
    host: '0.0.0.0',
    port: 5000,
    hot: true,
    historyApiFallback: true,
    open: true,
    proxy: {
      '/api': {
        changeOrigin: true,
        headers: {
          referer: 'https://treeherder.mozilla.org/webpack-dev-server',
        },
        // Support BACKEND environment variable provided by npm run scripts
        target: process.env.BACKEND || 'https://treeherder.mozilla.org',
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
    devMiddleware: {
      stats: {
        all: false,
        errors: true,
        timings: true,
        warnings: true,
      },
    },
    static: {
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: /node_modules/,
      },
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
      name: false,
    },
    runtimeChunk: 'single',
  },

  plugins: [
    new HotModuleReplacementPlugin({
      template: 'ui/index.html',
      lang: 'en',
      filename: 'index.html',
    }),
    new HotModuleReplacementPlugin({
      template: 'ui/redoc.html',
      lang: 'en',
      filename: 'redoc.html',
    }),
  ],

  infrastructureLogging: {
    level: 'warn',
  },

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
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[ext]',
        },
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        generator: {
          filename: 'assets/[name].[ext]',
        },
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
    new HtmlWebpackPlugin({
      template: 'ui/redoc.html',
      lang: 'en',
      meta: false,
      filename: 'redoc.html',
      chunks: ['redoc'],
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
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[hash:8].[ext]',
        },
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        generator: {
          filename: 'assets/[name].[hash:8].[ext]',
        },
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
