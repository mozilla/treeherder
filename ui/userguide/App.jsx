import React from 'react';
import { hot } from 'react-hot-loader/root';

import PerfherderUserGuide from '../perfherder/userguide/PerherderUserGuide';

import UserGuideHeader from './UserGuideHeader';
import UserGuideBody from './UserGuideBody';
import UserGuideFooter from './UserGuideFooter';

import '../css/treeherder-base.css';
import '../css/treeherder-custom-styles.css';
import '../css/treeherder-userguide.css';
import '../css/treeherder-job-buttons.css';

const App = () => (
  <div id="userguide">
    <div className="card">
      <UserGuideHeader />
      <UserGuideBody />
    </div>
    <div className="card my-3">
      <PerfherderUserGuide />
    </div>
    <UserGuideFooter />
  </div>
);

export default hot(App);
