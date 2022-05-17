const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { ProvidePlugin } = require('webpack');

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
          {
            loader: 'html-loader',
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
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              babelrc: false,
              configFile: false,
              presets: [
                [
                  '@babel/preset-env',
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
                  '@babel/preset-react',
                  {
                    development: false,
                    useSpread: true,
                  },
                ],
              ],
              plugins: [
                '@babel/plugin-syntax-dynamic-import',
                'react-hot-loader',
                [
                  'babel-plugin-transform-react-remove-prop-types',
                  {
                    removeImport: true,
                  },
                ],
                [
                  '@babel/plugin-proposal-class-properties',
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
              {
                loader: 'mini-css-extract-plugin',
                options: {
                  esModule: true,
                },
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
              name: 'assets/[name].[hash:8].[ext]',
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
  performance: {
    hints: 'error',
    maxAssetSize: 1782579.2,
    maxEntrypointSize: 2621440,
  },
  entry: {
    index: ['/app/ui/index'],
  },
};
