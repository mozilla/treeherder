'use strict';

// Webpack entry point for userguide.html
// Scripts and styles included here are automatically included on the page at build time

// Styles
require('bootstrap/dist/css/bootstrap.css');
require('./css/treeherder-global.css');
require('./css/treeherder-userguide.css');
require('./css/treeherder-job-buttons.css');
require('font-awesome/css/font-awesome.css');

// Userguide JS
require('./js/userguide.js');
require('./js/controllers/userguide.js');
