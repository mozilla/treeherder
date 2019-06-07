import { createStore, combineReducers, applyMiddleware } from 'redux';
import createDebounce from 'redux-debounce';

import * as selectedJobStore from './stores/selectedJob';
import * as notificationStore from './stores/notifications';

export default () => {
  const debounceConfig = {
    nextJob: 200,
  };
  const debouncer = createDebounce(debounceConfig);
  const reducers = combineReducers({
    notifications: notificationStore.reducer,
    selectedJob: selectedJobStore.reducer,
  });

  const store = createStore(reducers, applyMiddleware(debouncer));

  return { store };
};
