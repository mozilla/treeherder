import React from 'react';
import { render } from 'react-dom';
import * as Sentry from '@sentry/react';

import App from './App';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder-base.css';

// During production we want to report under which app the code
// is deployed by using HEROKU_APP (e.g. treeherder-prod)
//
// During development we want to report to the 'dev' release
// rather than reporting commits from the local checkout, otherwise, let
// it use the commit hash
Sentry.init({
  dsn:
    'https://c6385f3aab0c4340b90ec2db9e9e3544@o493645.ingest.sentry.io/5567629',
  environment:
    process.env.NODE_ENV === 'production'
      ? process.env.HEROKU_APP
      : 'development',
  release: process.env.NODE_ENV === 'dev' ? 'env' : null,
});
Sentry.captureMessage('Something went wrong');

render(<App />, document.getElementById('root'));
