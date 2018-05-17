// Webpack entry point for perf.html

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';
import 'metrics-graphics/dist/metricsgraphics.css';

// Vendor JS
import 'bootstrap';
// The official 'flot' NPM package is out of date, so we're using 'jquery.flot'
// instead, which is identical to https://github.com/flot/flot
import 'jquery.flot';
import 'jquery.flot/jquery.flot.time';
import 'jquery.flot/jquery.flot.selection';

// Perf Styles
import './css/treeherder-global.css';
import './css/treeherder-navbar.css';
import './css/perf.css';
import './css/treeherder-loading-overlay.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/perf';

// Perf JS
import './js/services/treestatus';
import './js/filters';
import './js/models/option_collection';
import './js/services/main';
import './js/services/taskcluster';
import './js/models/repository';
import './js/models/job';
import './js/models/runnable_job';
import './js/models/resultset';
import './js/services/tcactions';
import './js/models/user';
import './js/models/error';
import './js/models/perf/series';
import './js/models/perf/issue_tracker';
import './js/models/perf/performance_framework';
import './js/models/perf/alerts';
import './js/services/perf/math';
import './js/services/perf/compare';
import './js/controllers/perf/compare';
import './js/controllers/perf/graphs';
import './js/controllers/perf/alerts';
import './js/controllers/perf/dashboard';
import './js/components/perf/compare';
import './js/components/auth';
import './js/components/loading';
import './js/perfapp';
