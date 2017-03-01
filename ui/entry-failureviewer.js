'use strict';
// Webpack entry point for failurereviewer.html
// Scripts and styles included here are automatically included on the page at build time

require("./js/config");

// Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');
require('./css/treeherder-global.css');
require('./css/treeherder-notifications.css');
require('./css/failureviewer.css');

// Vendor JS
require('angular');
require('angular-route');
require('angular-resource');
require('angular-cookies');
require('angular-sanitize');
require('angular-local-storage');
require('bootstrap/dist/js/bootstrap');
require('angular-ui-bootstrap');
require('react-dom');
require('ngreact');
require('./vendor/resizer.js');

// Failureviewer JS
require('./js/providers.js');
require('./js/directives/treeherder/main.js');
require('./js/services/main.js');
require('./js/services/log.js');
require('./js/models/classified_failure.js');
require('./js/models/failure_lines.js');
require('./js/filters.js');
require('./js/controllers/failureviewer.js');
