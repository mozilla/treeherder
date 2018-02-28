// Webpack entry point for userguide.html

// Vendor Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');

// Userguide Styles
require('./css/treeherder-global.css');
require('./css/treeherder-userguide.css');
require('./css/treeherder-job-buttons.css');

// Bootstrap the Angular modules against which everything will be registered
require('./js/userguide.js');

// Userguide JS
require('./js/controllers/userguide.js');
