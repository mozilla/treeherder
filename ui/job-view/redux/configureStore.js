import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';

import * as pushesStore from './stores/pushes';

const reducers = combineReducers({
  pushes: pushesStore.reducer,
});

export function configureStore() {
  const store = createStore(reducers, applyMiddleware(thunk));

  return store;
}

export default configureStore;
