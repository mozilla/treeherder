import { createStore, bindActionCreators, combineReducers } from 'redux';
import * as pushes from './modules/pushes';

export default () => {
  const reducer = combineReducers({
    pushes: pushes.reducer,
  });
  const store = createStore(reducer);
  const actions = {
    pushes: bindActionCreators(pushes.actions, store.dispatch),
  };

  return { store, actions };
};
