import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

// Import custom Bootstrap 5 with Treeherder variables
import './css/bootstrap-custom.scss';
import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder-base.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
