import React from 'react';
import { render } from 'react-dom';

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';

// Vendor JS
import 'bootstrap';
import 'jquery.scrollto';

// Treeherder Styles
import '../css/treeherder.css';
import '../css/treeherder-global.css';
import '../css/treeherder-navbar.css';
import '../css/treeherder-navbar-panels.css';
import '../css/treeherder-notifications.css';
import '../css/treeherder-details-panel.css';
import '../css/treeherder-job-buttons.css';
import '../css/treeherder-resultsets.css';
import '../css/treeherder-pinboard.css';
import '../css/treeherder-bugfiler.css';
import '../css/treeherder-loading-overlay.css';

import App from './App';

render(<App />, document.getElementById('root'));
