'use strict';
const { join } = require('path');
const { ProvidePlugin } = require('webpack');
const lint = require('./lint');
const development = require('./development');
const production = require('./production');
const test = require('./test');
const notTest = require('./not-test');
const localWatch = require('./local-watch');
const react = require('neutrino-preset-react');
const HtmlPlugin = require('html-webpack-plugin');

const HTML_MINIFY_OPTIONS = {
    useShortDoctype: true,
    keepClosingSlash: true,
    collapseWhitespace: true,
    preserveLineBreaks: true
};

const entries = ['index', 'admin', 'perf', 'logviewer', 'failureviewer', 'userguide'];

module.exports = neutrino => {
    const { source } = neutrino.options;
    const { NODE_ENV, LOCAL_WATCH } = process.env;

    neutrino.config
        // Environment-specific configuration
        .when(NODE_ENV === 'development' && !LOCAL_WATCH, () => neutrino.use(development))
        .when(NODE_ENV === 'production' || LOCAL_WATCH || NODE_ENV === 'test', () => neutrino.use(production))
        .when(NODE_ENV === 'test' && !LOCAL_WATCH, () => neutrino.use(test), () => neutrino.use(notTest))
        .when(LOCAL_WATCH, () => neutrino.use(localWatch))

        // Common configuration
        .plugins
            .delete('html').end()
        .plugin('provide')
            // Now provide a few globals (providing angular here does not seem to work, though)
            .use(ProvidePlugin, [{
                $: require.resolve('jquery'),
                jQuery: require.resolve('jquery'),
                'window.$': require.resolve('jquery'),
                'window.jQuery': require.resolve('jquery'),
                React: require.resolve('react'),
                _: require.resolve('lodash'),
                treeherder: require.resolve(join(source, 'js/treeherder.js')),
                treeherderApp: require.resolve(join(source, 'js/treeherder_app.js')),
                perf: require.resolve(join(source, 'js/perf.js')),
                admin: require.resolve(join(source, 'js/admin.js')),
                failureViewerApp: require.resolve(join(source, 'js/failureviewer.js')),
                logViewerApp: require.resolve(join(source, 'js/logviewer.js')),
                userguideApp: require.resolve(join(source, 'js/userguide.js'))
            }]).end()
        .entry('index')
            // Neutrino v5 added babel-polyfill by default to the index entry
            // point. Treeherder doesn't use this right now, so remove it
            // to avoid breaking anything on that entry.
            .delete(require.resolve('babel-polyfill')).end()
        .module
            .rule('html')
                .test(/\.(html|tmpl)$/)
                // Don't use file-loader for html, use raw-loader, which will allow us to
                // get the contents of the templates and load them into the templateCache automatically;
                // See ui/js/cache-templates.js.
                .use('raw')
                    .loader(require.resolve('raw-loader')).end()
        // The page templates should be excluded from the rule
        // so that they don't collide with the html plugins:
        .exclude
            .merge(entries.map(entry => join(source, `${entry}.html`))).end()
            .uses.delete('file');

    // Add several other treeherder entry points:
    entries.forEach(entry => neutrino.config
        .entry(entry)
            .add(join(source, `entry-${entry}.js`)).end()
        .plugin(`html-${entry}`)
            .use(HtmlPlugin, [{
                inject: 'body',
                filename: `${entry}.html`,
                template: join(source, `${entry}.html`),
                chunks: [entry, 'vendor', 'manifest'],
                minify: HTML_MINIFY_OPTIONS
            }]));
};
