import React from 'react';
import { render } from 'react-dom';

import '../css/treeherder-base.css';
import '../css/treeherder-custom-styles.css';
import '../css/treeherder-userguide.css';
import '../css/treeherder-job-buttons.css';

import App from './App';

render(<App />, document.getElementById('root'));
