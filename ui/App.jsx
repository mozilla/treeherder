import React from 'react';
import { Route, Switch, BrowserRouter } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

import IntermittentFailuresApp from './intermittent-failures/App';
import PerfherderApp from './perfherder/App';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';
// TODO
// Move user state to here and pass to all other apps
// Create one universal navbar with flexibility (render props)
// update any hrefs used for navigation to react router Links

const App = () => (
  <BrowserRouter>
    <div>
      <Switch>
        <Route exact path="/">
          <Home />
        </Route>
        <Route
          exact
          path="/login"
          render={(props) => <LoginCallback {...props} />}
        />
        <Route
          exact
          path="/taskcluster-auth"
          render={(props) => <TaskclusterCallback {...props} />}
        />
        {/* entry: 'job-view/index.jsx',
        entry: 'index',
        favicon: 'ui/img/tree_open.png',
        title: 'Treeherder',
        template: 'ui/index.html',
      },
      logviewer: {
        entry: 'logviewer/index.jsx',
        favicon: 'ui/img/logviewerIcon.png',
        title: 'Treeherder Logviewer',
        template: 'ui/index.html',
      },
      userguide: {
        entry: 'userguide/index.jsx',
        favicon: 'ui/img/tree_open.png',
        title: 'Treeherder User Guide',
        template: 'ui/index.html',
      },

      pushhealth: {
        entry: 'push-health/index.jsx',
        title: 'Push Health',
        favicon: 'ui/img/push-health-ok.png',
        template: 'ui/index.html', */}
        <Route
          path="/intermittent-failures"
          render={(props) => <IntermittentFailuresApp {...props} />}
        />
        <Route
          path="/perfherder"
          render={(props) => <PerfherderApp {...props} />}
        />
      </Switch>
    </div>
  </BrowserRouter>
);

function Home() {
  return (
    <div>
      <h2>Home</h2>
    </div>
  );
}

export default hot(App);
