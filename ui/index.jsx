import React from 'react';
import { render } from 'react-dom';
import * as Sentry from '@sentry/react';

import App from './App';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder-base.css';

Sentry.init({
  dsn:
    'https://55e8465b492c41fbb6af031de8b13e3e@o493645.ingest.sentry.io/5567629',
});

render(<App />, document.getElementById('root'));
