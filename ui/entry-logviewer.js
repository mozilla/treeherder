// Webpack entry point for logviewer.html

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';

// Vendor JS
import 'bootstrap';

// Logviewer Styles
import './css/treeherder-global.css';
import './css/logviewer.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/logviewer';

// Logviewer JS
import './js/directives/treeherder/log_viewer_steps';
import './js/directives/treeherder/main';
import './js/components/logviewer/logviewer';
import './js/services/main';
import './js/services/taskcluster';
import './js/models/job_detail';
import './js/models/job';
import './js/models/runnable_job';
import './js/models/resultset';
import './js/services/tcactions';
import './js/models/text_log_step';
import './js/filters';
import './js/controllers/logviewer';
