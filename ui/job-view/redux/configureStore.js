import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import createDebounce from 'redux-debounce';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import { createBrowserHistory } from 'history';

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

export function configureStore(routerHistory = history) {
  const store = createStore(
    reducers(routerHistory),
    applyMiddleware(routerMiddleware(routerHistory), thunk, debouncer),
  );

  return store;
}
