import { createStore, combineReducers, compose, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import createDebounce from 'redux-debounce';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import { createBrowserHistory } from 'history';
import * as Sentry from '@sentry/react';

import * as selectedJobStore from './stores/selectedJob';
import * as notificationStore from './stores/notifications';
import * as pushesStore from './stores/pushes';
import * as pinnedJobsStore from './stores/pinnedJobs';

const debouncer = createDebounce({ nextJob: 200 });

const reducers = (routerHistory) =>
  combineReducers({
    router: connectRouter(routerHistory),
    notifications: notificationStore.reducer,
    selectedJob: selectedJobStore.reducer,
    pushes: pushesStore.reducer,
    pinnedJobs: pinnedJobsStore.reducer,
  });

export const history = createBrowserHistory();

const sentryReduxEnhancer = Sentry.createReduxEnhancer({});

export function configureStore(routerHistory = history) {
  const store = createStore(
    reducers(routerHistory),
    compose(
      applyMiddleware(routerMiddleware(routerHistory), thunk, debouncer),
      sentryReduxEnhancer,
    ),
  );

  return store;
}
