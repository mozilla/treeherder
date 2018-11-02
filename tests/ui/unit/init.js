// Karma/webpack entry for tests

// Manually import angular since angular-mocks doesn't do so itself
import 'angular';
import 'angular-mocks';
import 'jasmine-jquery';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

const jsContext = require.context('../../../ui/js', true, /^\.\/.*\.jsx?$/);
jsContext('./filters.js');

const testContext = require.context('./', true, /^\.\/.*\.tests\.jsx?$/);
testContext.keys().forEach(testContext);
