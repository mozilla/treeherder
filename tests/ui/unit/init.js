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

const testContext = require.context('./', true, /^\.\/.*\.tests\.jsx?$/);
testContext.keys().forEach(testContext);
