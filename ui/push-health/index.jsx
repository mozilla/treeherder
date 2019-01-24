import React from 'react';
import { render } from 'react-dom';

// Vendor Styles
import 'bootstrap/dist/css/bootstrap.min.css';

// Treeherder Styles
import '../css/treeherder-navbar.css';

import App from './App';

render(<App />, document.getElementById('root'));
