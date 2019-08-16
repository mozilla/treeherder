import React from 'react';
import { render } from 'react-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-table/react-table.css';

import '../css/treeherder-global.css';
import '../css/treeherder-navbar.css';
import '../css/perf.css';

import App from './App';

render(<App />, document.getElementById('root'));
