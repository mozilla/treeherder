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
import './js/services/treestatus';
import './js/services/tcactions';
import './js/models/resultset';
import './js/models/resultsets_store';
import './js/models/job_detail';
import './js/models/repository';
import './js/models/bug_job_map';
import './js/models/classification';
import './js/models/job';
import './js/models/runnable_job';
import './js/models/build_platform';
import './js/models/job_type';
import './js/models/job_group';
import './js/models/job_log_url';
import './js/models/option_collection';
import './js/models/user';
import './js/models/error';
import './js/models/failure_lines';
import './js/models/text_log_errors';
import './js/models/bug_suggestions';
import './js/models/text_log_step';
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
import './plugins/similar_jobs/controller';
import './details-panel/JobDetailsPane';
import './details-panel/FailureSummaryTab';
import './details-panel/AutoclassifyTab';
import './details-panel/AnnotationsTab';
import './js/filters';
