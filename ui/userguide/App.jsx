import React from 'react';
import { hot } from 'react-hot-loader';

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
  </div>
);

export default hot(module)(App);
