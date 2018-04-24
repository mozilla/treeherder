'use strict';
const path = require('path');
const webpack = require('webpack');
const lintPreset = require('./lint');
const reactPreset = require('neutrino-preset-react');
const HtmlPlugin = require('html-webpack-plugin');
const htmlTemplate = require('html-webpack-template');

const CWD = process.cwd();
const SRC = path.join(CWD, 'src'); // neutrino's default source directory
const UI = path.join(CWD, 'ui');
const DIST = path.join(CWD, 'dist');
const INDEX_TEMPLATE = path.join(UI, 'index.html');
const PERF_TEMPLATE = path.join(UI, 'perf.html');
const LOGVIEWER_TEMPLATE = path.join(UI, 'logviewer.html');
const USERGUIDE_TEMPLATE = path.join(UI, 'userguide.html');

const HTML_MINIFY_OPTIONS = {
    useShortDoctype: true,
    keepClosingSlash: true,
    collapseWhitespace: true,
    preserveLineBreaks: true
};

module.exports = neutrino => {
    reactPreset(neutrino);
    lintPreset(neutrino);

    // Change the ouput path from build/ to dist/:
    neutrino.config.output.path(DIST);

    if (process.env.NODE_ENV !== 'test') {
        // Include files from node_modules in the separate, more-cacheable vendor chunk:
        const jsDeps = [
            'angular',
            'angular-local-storage',
            'angular-resource',
            'angular-route',
            'angular-sanitize',
            'angular-toarrayfilter',
            'angular-ui-router',
            'angular1-ui-bootstrap4',
            'auth0-js',
            'bootstrap',
            'hawk',
            'jquery',
            'jquery.scrollto',
            'js-yaml',
            'metrics-graphics',
            'mousetrap',
            'numeral',
            'prop-types',
            'react',
            'react-dom',
            'react-highlight-words',
            'react-select',
            'taskcluster-client-web'
        ];
        jsDeps.map(dep =>
            neutrino.config.entry('vendor').add(dep)
        );
    }

    // Neutrino looks for the entry at src/index.js by default; Delete this and add the index in ui/:
    neutrino.config
        .entry('index')
        .delete(path.join(SRC, 'index.js'))
        .add(path.join(UI, 'entry-index.js'))
        .end();
    // Add several other treeherder entry points:
    neutrino.config
        .entry('perf')
        .add(path.join(UI, 'entry-perf.js'))
        .end();
    neutrino.config
        .entry('logviewer')
        .add(path.join(UI, 'entry-logviewer.js'))
        .end();
    neutrino.config
        .entry('login')
        .add(path.join(UI, 'entry-login.jsx'))
        .end();
    neutrino.config
        .entry('userguide')
        .add(path.join(UI, 'entry-userguide.js'))
        .end();
    neutrino.config
        .entry('testview')
        .add(path.join(UI, 'test-view', 'index.jsx'))
        .end();
    neutrino.config
        .entry('intermittent-failures')
        .add(path.join(UI, 'intermittent-failures', 'index.jsx'))
        .end();

    // Likewise, we must modify the include paths for the compile rule to look in ui/ instead of src/:
    neutrino.config
        .module
        .rule('compile')
        .include(UI);

    // Don't use file loader for html...
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v4.2.0/packages/neutrino-preset-web/src/index.js#L64-L69
    neutrino.config
        .module
        .rule('html')
        .loaders.delete('file');
    // Instead, use html-loader, like Neutrino 8:
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v8.0.18/packages/html-loader/index.js#L7
    neutrino.config
        .module
        .rule('html')
        .loader('html', require.resolve('html-loader'), {
            // Override html-loader's default of `img:src`,
            // so it also parses favicon images (`<link href="...">`).
            attrs: ['img:src', 'link:href']
        });

    // Backport Neutrino 8's `test` regex, since Neutrino 4 omitted `.gif`:
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v4.2.0/packages/neutrino-preset-web/src/index.js#L108
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v8.0.18/packages/image-loader/index.js#L20
    // Fixes "You may need an appropriate loader to handle this file type" errors for `dancing_cat.gif`.
    neutrino.config
        .module
        .rule('img')
        .test(/\.(png|jpg|jpeg|gif|webp)(\?v=\d+\.\d+\.\d+)?$/);

    // Remove Neutrino 4's invalid SVG mimetype, and use auto-detection instead, like Neutrino 8.
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v4.2.0/packages/neutrino-preset-web/src/index.js#L98-L104
    // https://github.com/mozilla-neutrino/neutrino-dev/blob/v8.0.18/packages/image-loader/index.js#L11-L16
    // Fixes the log viewer icon on the job details panel (which url-loader embeds as a base64 encoded data URI).
    neutrino.config
        .module
        .rule('svg')
        .loader('url', ({ options }) => {
            options.mimetype = null;
            return { options };
        });

    // Set up templates for each entry point:
    neutrino.config.plugins.delete('html');
    neutrino.config
        .plugin('html-index')
        .use(HtmlPlugin, {
            inject: 'body',
            template: INDEX_TEMPLATE,
            chunks: ['index', 'vendor', 'manifest'],
            minify: HTML_MINIFY_OPTIONS
        });

    neutrino.config
        .plugin('html-perf')
        .use(HtmlPlugin, {
            inject: 'body',
            filename: 'perf.html',
            template: PERF_TEMPLATE,
            chunks: ['perf', 'vendor', 'manifest'],
            minify: HTML_MINIFY_OPTIONS
        });

    neutrino.config
        .plugin('html-logviewer')
        .use(HtmlPlugin, {
            inject: 'body',
            filename: 'logviewer.html',
            template: LOGVIEWER_TEMPLATE,
            chunks: ['logviewer', 'vendor', 'manifest'],
            minify: HTML_MINIFY_OPTIONS
        });

    neutrino.config
        .plugin('html-userguide')
        .use(HtmlPlugin, {
            inject: 'body',
            filename: 'userguide.html',
            template: USERGUIDE_TEMPLATE,
            chunks: ['userguide', 'vendor', 'manifest'],
            minify: HTML_MINIFY_OPTIONS
        });


    neutrino.config
        .plugin('html-login')
        .use(HtmlPlugin, {
            inject: false,
            template: htmlTemplate,
            filename: 'login.html',
            chunks: ['login', 'vendor', 'manifest'],
            appMountId: 'root',
            xhtml: true,
            mobile: true,
            minify: HTML_MINIFY_OPTIONS,
            title: 'Treeherder Login',
            meta: [
                {
                    "name": "description",
                    "content": "Treeherder Login"
                },
                {
                    "name": "author",
                    "content": "Mozilla Treeherder"
                }
            ]
        });


    neutrino.config
        .plugin('html-testview')
        .use(HtmlPlugin, {
            inject: false,
            template: htmlTemplate,
            filename: 'testview.html',
            chunks: ['testview', 'vendor', 'manifest'],
            appMountId: 'root',
            xhtml: true,
            mobile: true,
            minify: HTML_MINIFY_OPTIONS,
            title: "Treeherder TestView",
            meta: [
                {
                    "name": "description",
                    "content": "Treeherder TestView"
                },
                {
                    "name": "author",
                    "content": "Mozilla Treeherder"
                }
            ]
        });

    neutrino.config
        .plugin('html-intermittent-failures')
        .use(HtmlPlugin, {
            inject: false,
            template: htmlTemplate,
            filename: 'intermittent-failures.html',
            chunks: ['intermittent-failures', 'vendor', 'manifest'],
            appMountId: 'root',
            xhtml: true,
            mobile: true,
            minify: HTML_MINIFY_OPTIONS,
            title: "Treeherder Intermittent Failures",
            meta: [
                {
                    "name": "description",
                    "content": "Treeherder Intermittent Failures"
                },
                {
                    "name": "author",
                    "content": "Mozilla Treeherder"
                }
            ]
        });

    // Adjust babel env to loosen up browser compatibility requirements
    neutrino.config
        .module
        .rule('compile')
        .loader('babel', ({ options }) => {
            options.presets[0][1].targets.browsers = [
                'last 1 Chrome versions',
                'last 1 Firefox versions',
                'last 1 Edge versions',
                'last 1 Safari versions'
            ];
            // Work around a transform-regenerator bug that causes "Cannot read property '0' of null"
            // when encountering usages of async. See:
            // https://github.com/babel/babel/issues/4759
            options.presets[0][1].include = options.presets[0][1].include.filter(e => e !== 'transform-regenerator');
            return options;
        });

    neutrino.config
        .plugin('provide')
        .use(webpack.ProvidePlugin, {
            $: require.resolve('jquery'),
            jQuery: require.resolve('jquery'),
            'window.$': require.resolve('jquery'),
            'window.jQuery': require.resolve('jquery'),
            React: require.resolve('react'),
            _: require.resolve('lodash'),
        });

    neutrino.config.devtool('source-map');
};

module.exports.CWD = CWD;
module.exports.UI = UI;
module.exports.DIST = DIST;
