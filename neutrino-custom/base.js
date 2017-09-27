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
const FAILUREVIEWER_TEMPLATE = path.join(UI, 'failureviewer.html');
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
            'angular', 'angular-cookies', 'angular-local-storage', 'angular-resource',
            'angular-route', 'angular-sanitize', 'angular-toarrayfilter', 'angular1-ui-bootstrap4',
            'angular-ui-router', 'bootstrap/dist/js/bootstrap', 'hawk', 'jquery', 'jquery.scrollto',
            'js-yaml', 'mousetrap', 'prop-types', 'react', 'react-dom', 'taskcluster-client',
            'numeral', 'metrics-graphics'];
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
        .entry('failureviewer')
        .add(path.join(UI, 'entry-failureviewer.js'))
        .end();
    neutrino.config
        .entry('userguide')
        .add(path.join(UI, 'entry-userguide.js'))
        .end();
    neutrino.config
        .entry('testview')
        .add(path.join(UI, 'test-view', 'index.js'))
        .end();

    // Likewise, we must modify the include paths for the compile rule to look in ui/ instead of src/:
    neutrino.config
        .module
        .rule('compile')
        .include(UI);

    // The page templates should be excluded from the file-loader, so that they don't collide with the html plugins:
    neutrino.config
        .module
        .rule('html')
        ._exclude
        .add([USERGUIDE_TEMPLATE, PERF_TEMPLATE, LOGVIEWER_TEMPLATE,
            INDEX_TEMPLATE, FAILUREVIEWER_TEMPLATE]);

    // Don't use file loader for html...
    neutrino.config
        .module
        .rule('html')
        .loaders.delete('file');
    // Instead, use the raw loader, which will allow us to get the contents
    // of the templates and load them into the templateCache automatically;
    // See ui/js/cache-templates.js.
    neutrino.config
        .module
        .rule('html')
        .test(/\.(html|tmpl)$/)
        .loader('raw', require.resolve('raw-loader'));

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
        .plugin('html-failureviewer')
        .use(HtmlPlugin, {
            inject: 'body',
            filename: 'failureviewer.html',
            template: FAILUREVIEWER_TEMPLATE,
            chunks: ['failureviewer', 'vendor', 'manifest'],
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
            title: "Treeherder TestGroup - Experimental",
            meta: [
                {
                    "name": "description",
                    "content": "Treeherder TestGroup - Experimental"
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

    // Now provide a few globals (providing angular here does not seem to work, though)
    neutrino.config
        .plugin('provide')
        .use(webpack.ProvidePlugin, {
            $: require.resolve('jquery'),
            jQuery: require.resolve('jquery'),
            'window.$': require.resolve('jquery'),
            'window.jQuery': require.resolve('jquery'),
            // Required by Bootstrap 4: https://getbootstrap.com/docs/4.0/getting-started/webpack/
            Popper: ['popper.js', 'default'],
            React: require.resolve('react'),
            _: require.resolve('lodash'),
            treeherder: require.resolve(path.join(UI, 'js/treeherder.js')),
            treeherderApp: require.resolve(path.join(UI, 'js/treeherder_app.js')),
            perf: require.resolve(path.join(UI, 'js/perf.js')),
            failureViewerApp: require.resolve(path.join(UI, 'js/failureviewer.js')),
            logViewerApp: require.resolve(path.join(UI, 'js/logviewer.js')),
            userguideApp: require.resolve(path.join(UI, 'js/userguide.js'))
        });
};

module.exports.CWD = CWD;
module.exports.UI = UI;
module.exports.DIST = DIST;
