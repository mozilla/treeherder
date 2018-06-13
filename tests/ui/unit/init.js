// Karma/webpack entry for tests

import jQuery from 'jquery';
// Manually import angular since angular-mocks doesn't do so itself
import 'angular';
import 'angular-mocks';
import 'jasmine-jquery';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

// Global variables are set here instead of with webpack.ProvidePlugin
// because neutrino removes plugin definitions for karma runs:
// https://github.com/mozilla-neutrino/neutrino-dev/issues/617
window.jQuery = jQuery;

configure({ adapter: new Adapter() });

const jsContext = require.context('../../../ui/js', true, /^\.\/.*\.jsx?$/);
jsContext('./filters.js');

const controllerContext = require.context('../../../ui/js/controllers', true, /^\.\/.*\.jsx?$/);
controllerContext.keys().forEach(controllerContext);
const directiveContext = require.context('../../../ui/js/directives', true, /^\.\/.*\.jsx?$/);
directiveContext.keys().forEach(directiveContext);
const modelContext = require.context('../../../ui/js/models', true, /^\.\/.*\.jsx?$/);
modelContext.keys().forEach(modelContext);
const serviceContext = require.context('../../../ui/js/services', true, /^\.\/.*\.jsx?$/);
serviceContext.keys().forEach(serviceContext);
const componentContext = require.context('../../../ui/js/components', true, /^\.\/.*\.jsx?$/);
componentContext.keys().forEach(componentContext);

const testContext = require.context('./', true, /^\.\/.*\.tests\.jsx?$/);
testContext.keys().forEach(testContext);
