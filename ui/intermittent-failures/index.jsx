import React from 'react';
import { render } from 'react-dom';
import 'react-table/react-table.css';

import '../css/treeherder-global.css';
import '../css/treeherder-navbar.css';
import '../css/intermittent-failures.css';
import App from './App';

render(<App />, document.getElementById('root'));
