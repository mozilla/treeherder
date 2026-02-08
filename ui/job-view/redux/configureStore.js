import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import createDebounce from 'redux-debounce';

import * as selectedJobStore from './stores/selectedJob';
import * as notificationStore from './stores/notifications';
import * as pushesStore from './stores/pushes';
import * as pinnedJobsStore from './stores/pinnedJobs';

const debouncer = createDebounce({ nextJob: 200 });

const reducers = combineReducers({
  notifications: notificationStore.reducer,
  selectedJob: selectedJobStore.reducer,
  pushes: pushesStore.reducer,
  pinnedJobs: pinnedJobsStore.reducer,
});

export function configureStore() {
  const store = createStore(reducers, applyMiddleware(thunk, debouncer));

  return store;
}

export default configureStore;
