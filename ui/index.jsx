import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder-base.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
