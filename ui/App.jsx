import React from 'react';
import { Route, Switch, Redirect, useHistory } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

import IntermittentFailuresApp from './intermittent-failures/App';
import PerfherderApp from './perfherder/App';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';
import JobsViewApp from './job-view/App';

// TODO
// Move user state to here and pass to all other apps
// Create one universal navbar with flexibility (render props)
// update any hrefs used for navigation to react router Links
// react-helmet to update titles and favicons dynamically

const App = () => {
  const history = useHistory();
  console.log(history);
  // if (location.hash.startsWith('#/')) {
  //   history.push(location.hash.replace('#', '')) // or history.replace
  // }

  return (
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
        <Route
          exact
          path="/jobs"
          render={(props) => <JobsViewApp {...props} />}
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
        <Redirect from="/perf.html" to="/perfherder" />
        <Redirect
          from="/intermittent-failures.html"
          to="/intermittent-failures"
        />
        <Redirect from="/logviewer.html" to="/logviewer" />
      </Switch>
    </div>
  );
};
function Home() {
  return (
    <div>
      <h2>Home</h2>
    </div>
  );
}

export default hot(App);
