// Webpack entry point for logviewer.html

// Vendor Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');

// Vendor JS
require('bootstrap/dist/js/bootstrap');

// Logviewer Styles
require('./css/treeherder-global.css');
require('./css/logviewer.css');

// Bootstrap the Angular modules against which everything will be registered
require('./js/logviewer.js');

// Logviewer JS
require('./js/providers.js');
require('./js/values.js');
require('./js/directives/treeherder/log_viewer_steps.js');
require('./js/directives/treeherder/main.js');
require('./js/components/logviewer/logviewer.js');
require('./js/services/main.js');
require('./js/services/taskcluster.js');
require('./js/models/job_detail.js');
require('./js/models/job.js');
require('./js/models/runnable_job.js');
require('./js/models/resultset.js');
require('./js/services/tcactions.js');
require('./js/models/text_log_step.js');
require('./js/filters.js');
require('./js/controllers/logviewer.js');
