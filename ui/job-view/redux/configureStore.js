import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import createDebounce from 'redux-debounce';

import * as selectedJobStore from './stores/selectedJob';
import * as notificationStore from './stores/notifications';
import * as pushesStore from './stores/pushes';

export default () => {
  const debounceConfig = { nextJob: 200 };
  const debouncer = createDebounce(debounceConfig);
  const reducers = combineReducers({
    notifications: notificationStore.reducer,
    selectedJob: selectedJobStore.reducer,
    pushes: pushesStore.reducer,
  });
  const store = createStore(reducers, applyMiddleware(thunk, debouncer));

  return { store };
};
