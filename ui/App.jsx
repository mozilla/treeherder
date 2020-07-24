import React, { Suspense, lazy } from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

import LoadingSpinner from './shared/LoadingSpinner';
import JobsViewApp from './job-view/App';
// import LoginCallback from './login-callback/LoginCallback';
// import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';

const IntermittentFailuresApp = lazy(() =>
  import('./intermittent-failures/App'),
);
const PerfherderApp = lazy(() => import('./perfherder/App'));

// TODO
// Move user state to here and pass to all other apps
// Create one universal navbar with flexibility (render props)
// update any hrefs used for navigation to react router Links
// react-helmet to update titles and favicons dynamically

const App = () => {
  return (
    <div>
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          {/* <Route
          exact
          path="/login"
          render={(props) => <LoginCallback {...props} />}
        />
        <Route
          exact
          path="/taskcluster-auth"
          render={(props) => <TaskclusterCallback {...props} />}
        /> */}
          {/* TODO add redirect from / and add query param support */}
          <Route path="/jobs" render={(props) => <JobsViewApp {...props} />} />

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
          <Redirect from="/" to="/jobs" />
        </Switch>
      </Suspense>
    </div>
  );
};

export default hot(App);
