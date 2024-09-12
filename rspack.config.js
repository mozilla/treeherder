const path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
const rspack = require('@rspack/core');
// eslint-disable-next-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge');
// eslint-disable-next-line import/no-extraneous-dependencies
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

// Note: MomentLocalesPlugin doesn't have a direct Rspack equivalent
// Consider migrating to dayjs in the future for better tree-shaking

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
      vm: require.resolve('vm-browserify'),
      fs: false,
      tls: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(mjs|jsx|js)$/,
        resolve: {
          fullySpecified: false,
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
        include: [
          path.resolve(__dirname, 'ui'),
          path.resolve(__dirname, 'tests/ui'),
        ],
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'ecmascript',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: process.env.NODE_ENV === 'development',
                  refresh: process.env.NODE_ENV === 'development',
                },
              },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new rspack.ProvidePlugin({
      process: 'process/browser',
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'ui/contribute.json', to: 'contribute.json' },
        { from: 'ui/revision.txt', to: 'revision.txt' },
        { from: 'ui/robots.txt', to: 'robots.txt' },
      ],
    }),
    // Strip moment locales to reduce bundle size (keep only English)
    new rspack.ContextReplacementPlugin(/moment[/\\]locale$/, /en/),
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
    port: process.env.PORT || 5000,
    hot: true,
    historyApiFallback: true,
    open: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: (error) =>
          !error.message.includes(
            'ResizeObserver loop completed with undelivered notifications',
          ),
      },
    },
    proxy: [
      {
        context: ['/api'],
        target: process.env.BACKEND || 'https://treeherder.mozilla.org',
        changeOrigin: true,
        headers: {
          referer: 'https://treeherder.mozilla.org/rspack-dev-server',
        },
        onProxyRes: (proxyRes) => {
          // Strip the cookie `secure` attribute for non-HTTPS localhost
          const removeSecure = (str) => str.replace(/; secure/i, '');
          const cookieHeader = proxyRes.headers['set-cookie'];
          if (cookieHeader) {
            proxyRes.headers['set-cookie'] = Array.isArray(cookieHeader)
              ? cookieHeader.map(removeSecure)
              : removeSecure(cookieHeader);
          }
        },
      },
    ],
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
    },
    runtimeChunk: 'single',
  },

  plugins: [
    new rspack.HtmlRspackPlugin({
      template: 'ui/index.html',
      filename: 'index.html',
    }),
    new ReactRefreshPlugin(),
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
        test: /\.scss$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                quietDeps: true,
                silenceDeprecations: ['import'],
              },
            },
          },
        ],
      },
      {
        test: /\.(eot|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]',
        },
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        generator: {
          filename: 'assets/[name][ext]',
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
    clean: true, // Rspack has built-in clean
  },

  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5,
      cacheGroups: {
        redoc: {
          test: /[\\/]node_modules[\\/](mobx|redoc|styled-components)[\\/]/,
          name: 'redoc',
          chunks: 'all',
        },
      },
    },
    runtimeChunk: 'single',
  },

  performance: {
    hints: 'error',
    maxAssetSize: 2500000,
    maxEntrypointSize: 3000000,
  },

  plugins: [
    new rspack.HtmlRspackPlugin({
      template: 'ui/index.html',
      filename: 'index.html',
    }),
    new rspack.CssExtractRspackPlugin({
      filename: 'assets/[name].[contenthash:8].css',
    }),
  ],

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 0,
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          rspack.CssExtractRspackPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                quietDeps: true,
                silenceDeprecations: ['import'],
              },
            },
          },
        ],
      },
      {
        test: /\.(eot|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[hash:8][ext]',
        },
      },
      {
        test: /\.(ico|png|jpg|jpeg|gif|svg|webp)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        generator: {
          filename: 'assets/[name].[hash:8][ext]',
        },
      },
    ],
  },
};

module.exports = (env, args) => {
  const mode = args?.mode || process.env.NODE_ENV || 'development';
  process.env.NODE_ENV = mode;

  switch (mode) {
    case 'development':
      return merge(commonConfig, developmentConfig);
    case 'production':
      return merge(commonConfig, productionConfig);
    default:
      throw new Error('No matching configuration was found!');
  }
};
