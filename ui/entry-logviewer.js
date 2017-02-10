'use strict';
// Webpack entry point for logviewer.html
// Scripts and styles included here are automatically included on the page at build time
require('./js/config');

// Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');
require('./css/treeherder-global.css');
require('./css/logviewer.css');

// Vendor JS
require('angular');
require('angular-route');
require('angular-resource');
require('angular-cookies');
require('angular-sanitize');
require('angular-local-storage');
require('bootstrap/dist/js/bootstrap');
require('./vendor/resizer.js');

// Logviewer JS
require('./js/providers.js');
require('./js/values.js');
require('./js/directives/treeherder/log_viewer_steps.js');
require('./js/directives/treeherder/main.js');
require('./js/components/logviewer/logviewer.js');
require('./js/services/main.js');
require('./js/services/log.js');
require('./js/services/taskcluster.js');
require('./js/models/job_detail.js');
require('./js/models/job.js');
require('./js/models/runnable_job.js');
require('./js/models/resultset.js');
require('./js/models/text_log_step.js');
require('./js/filters.js');
require('./js/controllers/logviewer.js');
