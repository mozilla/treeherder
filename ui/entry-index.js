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
import './css/treeherder-details-panel.css';
import './css/treeherder-job-buttons.css';
import './css/treeherder-resultsets.css';
import './css/treeherder-pinboard.css';
import './css/treeherder-bugfiler.css';
import './css/treeherder-loading-overlay.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/treeherder_app';

// Treeherder React UI
import './job-view/JobView';

// ShortcutTable React UI
import './shared/ShortcutTable';

// Treeherder JS
import './js/directives/treeherder/main';
import './js/services/main';
import './js/models/perf/series';
import './js/controllers/main';
