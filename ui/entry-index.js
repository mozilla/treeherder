// Webpack entry point for index.html

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';

// Vendor JS
import 'bootstrap';
import 'jquery.scrollto';

// Treeherder Styles
import './css/treeherder-global.css';
import './css/treeherder-navbar.css';
import './css/treeherder-navbar-panels.css';
import './css/treeherder-notifications.css';
import './css/treeherder-info-panel.css';
import './css/treeherder-job-buttons.css';
import './css/treeherder-resultsets.css';
import './css/treeherder-pinboard.css';
import './css/treeherder-bugfiler.css';
import './css/treeherder-loading-overlay.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/treeherder_app';

// Treeherder React UI
import './job-view/PushList';

// Treeherder JS
import './js/components/auth';
import './js/directives/treeherder/main';
import './js/directives/treeherder/top_nav_bar';
import './js/directives/treeherder/bottom_nav_panel';
import './js/services/main';
import './js/services/buildapi';
import './js/services/taskcluster';
import './js/services/classifications';
import './js/services/jobfilters';
import './js/services/pinboard';
import './js/services/tcactions';
import './js/models/resultset';
import './js/models/resultsets_store';
import './js/models/repository';
import './js/models/perf/series';
import './js/controllers/main';
import './js/controllers/repository';
import './js/controllers/notification';
import './js/controllers/filters';
import './js/controllers/bugfiler';
import './js/controllers/tcjobactions';
import './plugins/tabs';
import './plugins/controller';
import './plugins/pinboard';
import './job-view/details/summary/SummaryPanel';
import './job-view/details/tabs/JobDetailsTab';
import './job-view/details/tabs/failureSummary/FailureSummaryTab';
import './job-view/details/tabs/autoclassify/AutoclassifyTab';
import './job-view/details/tabs/AnnotationsTab';
import './job-view/details/tabs/SimilarJobsTab';
import './job-view/details/tabs/PerformanceTab';
import './js/filters';
