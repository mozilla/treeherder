// Webpack entry point for userguide.html

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';

// Userguide Styles
import './css/treeherder-global.css';
import './css/treeherder-userguide.css';
import './css/treeherder-job-buttons.css';

// Bootstrap the Angular modules against which everything will be registered
import './js/userguide';

// Userguide JS
import './js/controllers/userguide';
