import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { hot } from 'react-hot-loader/root';
import { Helmet } from 'react-helmet';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';
import { RedocStandalone } from 'redoc';

import { permaLinkPrefix } from './perfherder/perf-helpers/constants';
import { configureStore, history } from './job-view/redux/configureStore';
import LoadingSpinner from './shared/LoadingSpinner';
import LoginCallback from './login-callback/LoginCallback';
import TaskclusterCallback from './taskcluster-auth-callback/TaskclusterCallback';
import UserGuideApp from './userguide/App';
import treeFavicon from './img/tree_open.png';
import logFavicon from './img/logviewerIcon.png';
import perfFavicon from './img/line_chart.png';
import healthFavicon from './img/push-health-ok.png';

const IntermittentFailuresApp = lazy(() =>
  import('./intermittent-failures/App'),
);
const PerfherderApp = lazy(() => import('./perfherder/App'));

const PushHealthApp = lazy(() => import('./push-health/App'));

const JobsViewApp = lazy(() => import('./job-view/App'));

const LogviewerApp = lazy(() => import('./logviewer/App'));

// backwards compatibility for routes like this: treeherder.mozilla.org/perf.html#/alerts?id=26622&hideDwnToInv=0
const updateOldUrls = () => {
  const { pathname, hash, search } = history.location;
  const updates = {};

  const urlMatch = {
    '/perf.html': '/perfherder',
    '/pushhealth.html': '/push-health',
    '/': '/jobs',
  };

  if (
    pathname.endsWith('.html') ||
    (pathname === '/' && hash.length) ||
    urlMatch[pathname]
  ) {
    updates.pathname = urlMatch[pathname] || pathname.replace(/.html|\//g, '');
  }

  if (hash.length) {
    const index = hash.indexOf('?');
    updates.search = hash.substring(index);
    const subRoute = hash.substring(1, index);

    // there are old subroutes such as with the logviewer we want to ignore, i.e.:
    // https://treeherder.mozilla.org/logviewer.html#/jobs?job_id=319893964&repo=autoland&lineNumber=2728
    if (index >= 2 && updates.pathname !== subRoute && subRoute !== '/jobs') {
      updates.pathname += subRoute;
    }
  } else if (search.length) {
    updates.search = search;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  history.push(updates);
};

// the urls need to be update for compatibility reasons, but we need to have exceptions from this
// the link created by the permalink functionality is broken by the updateOldUrls function
// for more information - https://bugzilla.mozilla.org/show_bug.cgi?id=1725329
const updateUrls = () => {
  if (!history.location.hash.includes(permaLinkPrefix)) {
    updateOldUrls();
  }
};

const faviconPaths = {
  '/jobs': { title: 'Treeherder Jobs View', favicon: treeFavicon },
  '/logviewer': {
    title: 'Treeherder Logviewer',
    favicon: logFavicon,
  },
  '/perfherder': { title: 'Perfherder', favicon: perfFavicon },
  '/userguide': {
    title: 'Treeherder User Guide',
    favicon: treeFavicon,
  },
  '/intermittent-failures': {
    title: 'Intermittent Failures View',
    favicon: treeFavicon,
  },
  '/push-health': {
    title: 'Push Health',
    favicon: healthFavicon,
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
  updateUrls();
  return (
    <Provider store={configureStore()}>
      <ConnectedRouter history={history}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route
              path="/login"
              render={(props) => <LoginCallback {...props} />}
            />
            <Route
              path="/taskcluster-auth"
              render={(props) => <TaskclusterCallback {...props} />}
            />
            <Route
              path="/jobs"
              render={(props) =>
                withFavicon(<JobsViewApp {...props} />, props.location.pathname)
              }
            />
            <Route
              path="/logviewer"
              render={(props) =>
                withFavicon(
                  <LogviewerApp {...props} />,
                  props.location.pathname,
                )
              }
            />
            <Route
              path="/userguide"
              render={(props) =>
                withFavicon(
                  <UserGuideApp {...props} />,
                  props.location.pathname,
                )
              }
            />
            <Route
              path="push-health/*"
              render={(props) =>
                withFavicon(<PushHealthApp {...props} />, '/push-health')
              }
            />
            <Route
              path="intermittent-failures/*"
              render={(props) =>
                withFavicon(
                  <IntermittentFailuresApp {...props} />,
                  '/intermittent-failures',
                )
              }
            />
            <Route
              path="perfherder/*"
              render={(props) =>
                withFavicon(<PerfherderApp {...props} />, '/perfherder')
              }
            />
            <Route
              path="/docs"
              render={(props) => (
                <RedocStandalone
                  specUrl="/api/schema/?format=openapi-json"
                  {...props}
                />
              )}
            />
          </Routes>
        </Suspense>
      </ConnectedRouter>
    </Provider>
  );
};

export default hot(App);
