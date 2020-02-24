import React from 'react';
import { render } from 'react-dom';

// Treeherder Styles
import '../css/treeherder-global.css';
import '../css/treeherder-navbar.css';
import './logviewer.css';

import App from './App';

render(<App />, document.getElementById('root'));
