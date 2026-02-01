import { Suspense, lazy, useEffect } from 'react';
import {
  Routes,
  Route,
  BrowserRouter,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { Provider } from 'react-redux';

import { permaLinkPrefix } from './perfherder/perf-helpers/constants';
import { configureStore } from './job-view/redux/configureStore';
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

const RedocApp = lazy(() => import('./RedocApp'));

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

// Component to handle favicon and title updates
const WithFavicon = ({ children, route }) => {
  const location = useLocation();

  useEffect(() => {
    const faviconConfig = faviconPaths[route];
    if (faviconConfig) {
      let { title } = faviconConfig;
      const { favicon } = faviconConfig;

      document.querySelector('link[rel="icon"]').href = favicon;

      const searchParams = new URLSearchParams(location.search);
      const id = searchParams.get('id');

      if (location.pathname === '/perfherder/alerts' && id) {
        title = `Alert #${id.toString()}`;
      }
      document.title = title;
    }
  }, [route, location]);

  return children;
};

// Component to handle URL updates for backwards compatibility
const UrlUpdater = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { pathname, hash, search } = location;

    // Skip if this is a permalink
    if (hash.includes(permaLinkPrefix)) {
      return;
    }

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
      updates.pathname = urlMatch[pathname] || pathname.replace(/\.html$/, '');
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
    }

    // Only navigate if we have a pathname update (i.e., an actual URL rewrite needed)
    // Don't navigate just for search params as that causes infinite loops
    if (updates.pathname) {
      if (!updates.search && search.length) {
        updates.search = search;
      }
      navigate(updates, { replace: true });
    }
  }, [location, navigate]);

  return children;
};

const AppRoutes = () => {
  return (
    <UrlUpdater>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginCallback />} />
          <Route path="/taskcluster-auth" element={<TaskclusterCallback />} />
          <Route
            path="/jobs/*"
            element={
              <WithFavicon route="/jobs">
                <JobsViewApp />
              </WithFavicon>
            }
          />
          <Route
            path="/logviewer/*"
            element={
              <WithFavicon route="/logviewer">
                <LogviewerApp />
              </WithFavicon>
            }
          />
          <Route
            path="/userguide/*"
            element={
              <WithFavicon route="/userguide">
                <UserGuideApp />
              </WithFavicon>
            }
          />
          <Route
            path="/push-health/*"
            element={
              <WithFavicon route="/push-health">
                <PushHealthApp />
              </WithFavicon>
            }
          />
          <Route
            path="/intermittent-failures/*"
            element={
              <WithFavicon route="/intermittent-failures">
                <IntermittentFailuresApp />
              </WithFavicon>
            }
          />
          <Route
            path="/perfherder/*"
            element={
              <WithFavicon route="/perfherder">
                <PerfherderApp />
              </WithFavicon>
            }
          />
          <Route path="/docs/*" element={<RedocApp />} />
        </Routes>
      </Suspense>
    </UrlUpdater>
  );
};

const App = () => {
  return (
    <Provider store={configureStore()}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
};

export { AppRoutes };
export default App;
