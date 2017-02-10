const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const config = require('neutrino-preset-web');
const path = require('path');

const CWD = process.cwd();
const UI = path.join(CWD, 'ui');
const TESTS = path.join(CWD, 'tests/ui/unit');
const DIST = path.join(CWD, 'dist');

const INDEX_TEMPLATE = path.join(UI, 'index.html');
const ADMIN_TEMPLATE = path.join(UI, 'admin.html');
const PERF_TEMPLATE = path.join(UI, 'perf.html');
const LOGVIEWER_TEMPLATE = path.join(UI, 'logviewer.html');
const FAILUREVIEWER_TEMPLATE = path.join(UI, 'failureviewer.html');
const USERGUIDE_TEMPLATE = path.join(UI, 'userguide.html');

// Neutrino web preset overrides
// --------------------

// Replace the html plugin that generates the index page with several treeherder views
const htmlIndex = config.plugins.findIndex(p => p.constructor.name === 'HtmlWebpackPlugin');
config.plugins.splice(htmlIndex, 1);
config.plugins.push(new HtmlWebpackPlugin({
    template: INDEX_TEMPLATE,
    inject: 'body',
    chunks: ['index', 'commons'],
    filename: 'index.html'
}), new HtmlWebpackPlugin({
    template: ADMIN_TEMPLATE,
    inject: 'body',
    chunks: ['admin', 'commons'],
    filename: 'admin.html'
}), new HtmlWebpackPlugin({
    template: PERF_TEMPLATE,
    inject: 'body',
    chunks: ['perf', 'commons'],
    filename: 'perf.html'
}), new HtmlWebpackPlugin({
    template: LOGVIEWER_TEMPLATE,
    inject: 'body',
    chunks: ['logviewer', 'commons'],
    filename: 'logviewer.html'
}), new HtmlWebpackPlugin({
    template: FAILUREVIEWER_TEMPLATE,
    inject: 'body',
    chunks: ['failureviewer', 'commons'],
    filename: 'failureviewer.html'
}), new HtmlWebpackPlugin({
    template: USERGUIDE_TEMPLATE,
    inject: 'body',
    chunks: ['userguide', 'commons'],
    filename: 'userguide.html'
}));
// The template files must also be excluded from processing by the file-loader,
// which is applied to other html files
const fileIndex = config.module.loaders.findIndex(l => l.loader === require.resolve('file-loader'));
config.module.loaders[fileIndex].exclude = [ INDEX_TEMPLATE, ADMIN_TEMPLATE,
    PERF_TEMPLATE, LOGVIEWER_TEMPLATE, FAILUREVIEWER_TEMPLATE ];

// Borrow the polyfill from the default entry
const polyfill = config.entry.index[0];
// Overwrite the default entry with several treeherder pages
config.entry = {
    index: [polyfill, path.join(UI, 'entry-index.js')],
    admin: [polyfill, path.join(UI, 'entry-admin.js')],
    perf: [polyfill, path.join(UI, 'entry-perf.js')],
    logviewer: [polyfill, path.join(UI, 'entry-logviewer.js')],
    failurereviewer: [polyfill, path.join(UI, 'entry-failurereviewer.js')],
    userguide: [polyfill, path.join(UI, 'entry-userguide.js')]
};

// The output directory in neutrino-preset-web is 'build'; Change this to 'dist'
config.output.path = DIST;

// Correct the eslint configuration path
config.eslint.configFile = path.join(__dirname, '.eslintrc');

// babel loader: rewrite the include list to use '/ui/' instead of '/src'
const babelIndex = config.module.loaders.findIndex(l => l.loader === require.resolve('babel-loader'));
config.module.loaders[babelIndex].include = [UI, TESTS];
// Use cache directory to speed up recompilation
config.module.loaders[babelIndex].cacheDirectory = true;
// Same for the eslint preLoader
const eslintIndex = config.module.preLoaders.findIndex(l => l.loader === require.resolve('eslint-loader'));
config.module.preLoaders[eslintIndex].include = [UI, TESTS];

// The service domain is used to set window.thServiceDomain and determines the domain for API endpoints
let SERVICE_DOMAIN = process.env.SERVICE_DOMAIN;

if (process.env.NODE_ENV === 'development') {
    // Adjust the content base for the development server
    config.devServer.contentBase = UI;

    // Determine the api base URL for the dev server
    // Use the SERVICE_DOMAIN env var if set, otherwise default to production
    if (SERVICE_DOMAIN === 'staging') {
        SERVICE_DOMAIN = 'https://treeherder.allizom.org';
    } else if (SERVICE_DOMAIN === 'production' || typeof SERVICE_DOMAIN === 'undefined')  {
        SERVICE_DOMAIN = 'https://treeherder.mozilla.org';
    }

    // Set up a proxy in front of /api/ requests
    config.devServer.proxy = {
        '/api/*': {
            target: SERVICE_DOMAIN,
            changeOrigin: true
        }
    };
} else if (process.env.NODE_ENV === 'production') {
    // Update the clean plugin to clean 'dist/' instead of 'build/'
    const cleanIndex = config.plugins.findIndex(p =>
        p.constructor.name === 'Plugin' && p.options.dry === false);
    config.plugins[cleanIndex].paths = [DIST];

    // Copy all files except JS and CSS files, since they will be bundled.
    // This only needs to be done in production since in development, assets
    // are served from from 'ui/' via webpack-dev-server
    config.plugins.push(
        new CopyPlugin([{ context: UI, from: `**/*` }],{ ignore: ['*.js*', '*.css'] })
    );
    config.output.filename = '[name].[chunkhash].bundle.js';
} else if (process.env.NODE_ENV === 'test') {
    config.module.loaders.push({
        test: /\.jsx?$/,
        exclude: /(node_modules|tests)/,
        loader: require.resolve('istanbul-instrumenter-loader')
    });
    // Required for enzyme support:
    config.externals = {
        'cheerio': 'window',
        'react/addons': true,
        'react/lib/ExecutionEnvironment': true,
        'react/lib/ReactContext': true
    };
    config.devtool = 'inline-source-map';
    Object.assign(config.karma, {
        browsers: ['Chrome'],
        coverageIstanbulReporter: {
            reports: ['html'],
            fixWebpackSourcePaths: true
        },
        plugins: [
            require.resolve('karma-webpack'),
            require.resolve('karma-chrome-launcher'),
            require.resolve('karma-coverage'),
            require.resolve('karma-jasmine'),
            require.resolve('karma-sourcemap-loader'),
            require.resolve('karma-coverage-istanbul-reporter')
        ],
        frameworks: ['jasmine'],
        files: [
            'tests/ui/unit/init.js',
            {pattern: 'tests/ui/mock/**/*.json', watched: true, served: true, included: false}
        ],
        preprocessors: {
            'tests/ui/unit/init.js': ['webpack', 'sourcemap'],
            'ui/**/*.js': ['webpack', 'sourcemap']
        },
        reporters: ['progress', 'coverage-istanbul'],
    });
}


// Additional configuration
// ------------------------

// Define the service domain globally for use in js/config/index.js, which sets window.thServiceDomain
config.plugins.push(new webpack.DefinePlugin({
    SERVICE_DOMAIN: JSON.stringify(SERVICE_DOMAIN)
}));

// Handle JSX files
config.module.loaders.push({
    test: /\.jsx$/,
    loader: require.resolve('babel-loader'),
    exclude: /node_modules/,
    query: {
        presets: ['react', 'es2015']
    }
});

// Provide several globals
// - Angular is omitted because it does not seem to work correctly when included this way
// - The minified lodash is retained because it is a custom build
// - Angular apps which are expected to be globals are provided here too
config.plugins.push(new webpack.ProvidePlugin({
    $: 'jquery',
    jQuery: 'jquery',
    'window.$': 'jquery',
    'window.jQuery': 'jquery',
    React: 'react',
    _: require.resolve('./ui/vendor/lodash.min.js'),
    treeherder: require.resolve('./ui/js/treeherder.js'),
    treeherderApp: require.resolve('./ui/js/treeherder_app.js'),
    perf: require.resolve('./ui/js/perf.js'),
    admin: require.resolve('./ui/js/admin.js'),
    failureViewerApp: require.resolve('./ui/js/failureviewer.js'),
    logViewerApp: require.resolve('./ui/js/logviewer.js'),
    userguideApp: require.resolve('./ui/js/userguide.js')
}));

module.exports = config;
