// We're not using @neutrinojs/karma since we'd end up overriding most of it in
// order to use Firefox instead of Chrome, jasmine instead of mocha, and so on.

const neutrino = require('neutrino');

process.env.NODE_ENV = 'test';

const webpackConfig = neutrino().webpack();

// Skip building the entrypoints, since everything is imported in tests/ui/unit/init.js.
delete webpackConfig.entry;

// Re-enable Buffer since Karma fails to work without it.
webpackConfig.node.Buffer = true;

// Work around karma-webpack hanging under webpack 4:
// https://github.com/webpack-contrib/karma-webpack/issues/322
webpackConfig.optimization.splitChunks = false;
webpackConfig.optimization.runtimeChunk = false;

module.exports = (config) => {
  config.set({
    plugins: [
      'karma-webpack',
      'karma-firefox-launcher',
      'karma-jasmine',
    ],
    browsers: ['FirefoxHeadless'],
    frameworks: ['jasmine'],
    files: [
      'tests/ui/unit/init.js',
      {
        pattern: 'tests/ui/mock/**/*.json',
        watched: true,
        included: false,
        served: true,
      },
    ],
    preprocessors: {
      'tests/ui/unit/init.js': ['webpack'],
    },
    webpack: webpackConfig,
    webpackMiddleware: {
      // Make the webpack compile output less verbose.
      stats: {
        all: false,
        errors: true,
        timings: true,
        warnings: true,
      },
    },
  });
};
