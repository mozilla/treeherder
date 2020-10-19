import React from 'react';
import { render } from 'react-dom';
import 'react-table/react-table.css';

import '../css/treeherder-base.css';
import '../css/treeherder-custom-styles.css';
import '../css/treeherder-navbar.css';
import '../css/intermittent-failures.css';
import App from './App';

render(<App />, document.getElementById('root'));
