import React, { Suspense, lazy } from 'react';
import { Route, Switch, useHistory, useLocation } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';

import LoadingSpinner from './shared/LoadingSpinner';
import JobsViewApp from './job-view/App';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';

const IntermittentFailuresApp = lazy(() =>
  import('./intermittent-failures/App'),
);
const PerfherderApp = lazy(() => import('./perfherder/App'));

// TODO
// Move user state to here and pass to all other apps
// Create one universal navbar with flexibility (render props)
// update any hrefs used for navigation to react router Links
// react-helmet to update titles and favicons dynamically

// backwards compatibility for routes like this: treeherder.mozilla.org/perf.html#/alerts?id=26622&hideDwnToInv=0
const updateOldUrls = () => {
  const history = useHistory();
  const location = useLocation();
  const { pathname, hash } = location;

  const urlMatch = {
    '/perf.html': '/perfherder',
    '/pushhealth.html': '/push-health',
  };
  const updates = {};

  if (pathname.endsWith('.html') || (pathname === '/' && hash.length)) {
    updates.pathname = urlMatch[pathname] || pathname.replace(/.html|\//g, '');
  }

  if (hash.length) {
    const index = hash.indexOf('?');
    updates.search = hash.substring(index);

    if (index >= 2) {
      updates.pathname += hash.substring(1, index);
    }
  }

  if (Object.keys(updates).length === 0) {
    return;
  }
  history.push(updates);
};

const App = () => {
  updateOldUrls();
  return (
    <div>
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
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
            path="/"
            render={(props) => <JobsViewApp {...props} />}
          />
          <Route path="/jobs" render={(props) => <JobsViewApp {...props} />} />

          {/* 
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
      </Suspense>
    </div>
  );
};

export default hot(App);
