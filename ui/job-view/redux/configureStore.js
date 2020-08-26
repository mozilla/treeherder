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

const reducers = (history) =>
  combineReducers({
    router: connectRouter(history),
    notifications: notificationStore.reducer,
    selectedJob: selectedJobStore.reducer,
    pushes: pushesStore.reducer,
    pinnedJobs: pinnedJobsStore.reducer,
  });

export const history = createBrowserHistory();

export function configureStore() {
  const store = createStore(
    reducers(history),
    applyMiddleware(routerMiddleware(history), thunk, debouncer),
  );

  return store;
}
