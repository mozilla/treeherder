'use strict';

// Karma/webpack entry for tests

// Global variables are set here instead of with webpack.ProvidePlugin
// because neutrino removes plugin definitions for karma runs
window.$ = require('jquery');
window.jQuery = require('jquery');
window._ = require('../../../ui/vendor/lodash.min.js');
window.angular = require('angular');
window.React = require('react');
window.SERVICE_DOMAIN = '';
window.thServiceDomain = '';
require('react-dom');
require('../vendor/jasmine-jquery.js');
require('angular-mocks');
require('angular-resource');
require('angular-route');
require('angular-sanitize');
require('angular-cookies');
require('angular-local-storage');
require('angular-toarrayfilter');
require('mousetrap');
require('js-yaml');
require('ngreact');
require('angular-ui-bootstrap');
require('../../../ui/vendor/resizer.js');

const jsContext = require.context('../../../ui/js', true, /^\.\/.*\.jsx?$/);
window.treeherder = jsContext('./treeherder.js');
window.treeherderApp = jsContext('./treeherder_app.js');
window.admin = jsContext('./admin.js');
window.perf = jsContext('./perf.js');
window.failureViewerApp = jsContext('./failureviewer.js');
window.logViewerApp = jsContext('./logviewer.js');
window.userguideApp = jsContext('./userguide.js');
jsContext('./values.js');
jsContext('./providers.js');
jsContext('./filters.js');

const controllerContext = require.context('../../../ui/js/controllers', true, /^\.\/.*\.jsx?$/);
controllerContext.keys().forEach(controllerContext);
const directiveContext = require.context('../../../ui/js/directives', true, /^\.\/.*\.jsx?$/);
directiveContext.keys().forEach(directiveContext);
const modelContext = require.context('../../../ui/js/models', true, /^\.\/.*\.jsx?$/);
modelContext.keys().forEach(modelContext);
const reactContext = require.context('../../../ui/js/react', true, /^\.\/.*\.jsx?$/);
reactContext.keys().forEach(reactContext);
const serviceContext = require.context('../../../ui/js/services', true, /^\.\/.*\.jsx?$/);
serviceContext.keys().forEach(serviceContext);
const componentContext = require.context('../../../ui/js/components', true, /^\.\/.*\.jsx?$/);
componentContext.keys().forEach(componentContext);
const pluginContext = require.context('../../../ui/plugins', true, /^\.\/.*\.jsx?$/);
pluginContext.keys().forEach(pluginContext);

const testContext = require.context('./', true, /^\.\/.*\.tests\.jsx?$/);
testContext.keys().forEach(testContext);
