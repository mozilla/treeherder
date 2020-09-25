import React from 'react';
import { hot } from 'react-hot-loader/root';

import PerfherderUserGuide from '../perfherder/userguide/PerherderUserGuide';

import UserGuideHeader from './UserGuideHeader';
import UserGuideBody from './UserGuideBody';
import UserGuideFooter from './UserGuideFooter';

const App = () => (
  <div id="userguide">
    <div className="card">
      <UserGuideHeader />
      <UserGuideBody />
      <UserGuideFooter />
    </div>
    <div className="card">
      <PerfherderUserGuide />
    </div>
  </div>
);

export default hot(App);
