'use strict';
// Webpack entry point for perf.html
// Scripts and styles included here are automatically included on the page at build time

require('./js/config');

// Styles
require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');
require('./css/treeherder-navbar.css');
require('./css/perf.css');
require('./css/treeherder-loading-overlay.css');

// Vendor JS
require('angular');
require('angular-resource');
require('angular-cookies');
require('angular-ui-router');
require('angular-sanitize');
require('angular-local-storage');
require('mousetrap');
require('bootstrap/dist/js/bootstrap');
require('angular-ui-bootstrap');
require('./vendor/angular-clipboard.js');
// The jquery flot package does not seem to be updated on npm, so we use a local version:
require('./vendor/jquery.flot.js');
require('./vendor/jquery.flot.time.js');
require('./vendor/jquery.flot.selection.js');

// Perf JS
require('./js/services/treestatus.js');
require('./js/providers.js');
require('./js/values.js');
require('./js/filters.js');
require('./js/models/option_collection.js');
require('./js/services/main.js');
require('./js/services/log.js');
require('./js/services/taskcluster.js');
require('./js/services/jsonpushes.js');
require('./js/models/repository.js');
require('./js/models/job.js');
require('./js/models/runnable_job.js');
require('./js/models/resultset.js');
require('./js/models/user.js');
require('./js/models/error.js');
require('./js/perf.js');
require('./js/models/perf/series.js');
require('./js/models/perf/performance_framework.js');
require('./js/models/perf/alerts.js');
require('./js/services/perf/math.js');
require('./js/services/perf/compare.js');
require('./js/controllers/perf/compare.js');
require('./js/controllers/perf/graphs.js');
require('./js/controllers/perf/alerts.js');
require('./js/controllers/perf/dashboard.js');
require('./js/controllers/perf/e10s-trend.js');
require('./js/components/perf/compare.js');
require('./js/components/auth.js');
require('./js/components/loading.js');
require('./js/perfapp.js');
require('./js/filters.js');
