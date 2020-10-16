import React, { Suspense, lazy } from 'react';
import {
  Route,
  Switch,
  useLocation,
  useHistory,
  Redirect,
} from 'react-router-dom';
import { hot } from 'react-hot-loader/root';
import { Helmet } from 'react-helmet';

import LoadingSpinner from './shared/LoadingSpinner';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';
import UserGuideApp from './userguide/App';

const IntermittentFailuresApp = lazy(() =>
  import('./intermittent-failures/App'),
);
const PerfherderApp = lazy(() => import('./perfherder/App'));

const PushHealthApp = lazy(() => import('./push-health/App'));

const JobsViewApp = lazy(() => import('./job-view/App'));

const LogviewerApp = lazy(() => import('./logviewer/App'));

// backwards compatibility for routes like this: treeherder.mozilla.org/perf.html#/alerts?id=26622&hideDwnToInv=0
const updateOldUrls = () => {
  const location = useLocation();
  const history = useHistory();
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

const faviconPaths = {
  '/jobs': { title: 'Treeherder Jobs View', favicon: 'ui/img/tree_open.png' },
  '/logviewer': {
    title: 'Treeherder Logviewer',
    favicon: 'ui/img/logviewerIcon.png',
  },
  '/perfherder': { title: 'Perfherder', favicon: 'ui/img/line_chart.png' },
  '/userguide': {
    title: 'Treeherder User Guide',
    favicon: 'ui/img/tree_open.png',
  },
  '/intermittent-failures': {
    title: 'Intermittent Failures View',
    favicon: 'ui/img/tree_open.png',
  },
  '/push-health': {
    title: 'Push Health',
    favicon: 'ui/img/push-health-ok.png',
  },
};

const withFavicon = (element, route) => {
  const { title, favicon } = faviconPaths[route];
  return (
    <React.Fragment>
      <Helmet defaultTitle={title}>
        <link rel={`${title} icon`} href={favicon} />
      </Helmet>
      {element}
    </React.Fragment>
  );
};

const App = () => {
  updateOldUrls();
  return (
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
          render={(props) =>
            withFavicon(<JobsViewApp {...props} />, props.location.pathname)
          }
        />
        <Route
          path="/logviewer"
          render={(props) =>
            withFavicon(<LogviewerApp {...props} />, props.location.pathname)
          }
        />
        <Route
          path="/userguide"
          render={(props) =>
            withFavicon(<UserGuideApp {...props} />, props.location.pathname)
          }
        />
        <Route
          path="/push-health"
          render={(props) =>
            withFavicon(<PushHealthApp {...props} />, props.location.pathname)
          }
        />
        <Route
          path="/intermittent-failures"
          render={(props) =>
            withFavicon(
              <IntermittentFailuresApp {...props} />,
              '/intermittent-failures',
            )
          }
        />
        <Route
          path="/perfherder"
          render={(props) =>
            withFavicon(<PerfherderApp {...props} />, '/perfherder')
          }
        />
      </Switch>
    </Suspense>
  );
};

export default hot(App);
