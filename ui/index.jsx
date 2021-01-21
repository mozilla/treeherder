import React from 'react';
import { render } from 'react-dom';
import * as Sentry from '@sentry/react';

import App from './App';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder-base.css';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});

render(<App />, document.getElementById('root'));
