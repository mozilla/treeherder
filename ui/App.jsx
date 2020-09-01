import React, { Suspense, lazy } from 'react';
import { Route, Switch, useLocation, Redirect } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';

import { configureStore, history } from './job-view/redux/configureStore';
import LoadingSpinner from './shared/LoadingSpinner';
import JobsViewApp from './job-view/App';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';
import LogviewerApp from './logviewer/App';
import UserGuideApp from './userguide/App';

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
    <Provider store={configureStore()}>
      <ConnectedRouter history={history}>
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
            <Route exact path="/">
              <Redirect to="/jobs" />
            </Route>
            <Route
              path="/jobs"
              render={(props) => <JobsViewApp {...props} />}
            />
            <Route
              path="/logviewer"
              render={(props) => <LogviewerApp {...props} />}
            />
            <Route
              path="/userguide"
              render={(props) => <UserGuideApp {...props} />}
            />

            {/* pushhealth: {
              entry: 'push-health/index.jsx',
              title: 'Push Health',
              favicon: 'ui/img/push-health-ok.png',
              template: 'ui/index.html',
            } */}
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
      </ConnectedRouter>
    </Provider>
  );
};

export default hot(App);
