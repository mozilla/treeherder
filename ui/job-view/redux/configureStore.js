import { createStore, combineReducers } from 'redux';

import * as notificationStore from './stores/notifications';

export default () => {
  const reducers = combineReducers({
    notifications: notificationStore.reducer,
  });
  const store = createStore(reducers);

  return { store };
};
