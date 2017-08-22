import {
  createStore,
  bindActionCreators,
  combineReducers,
  applyMiddleware,
} from 'redux';
import * as pushes from './modules/pushes';

function dummy(store, data) {
  store.dispatch(angular.types.DUMMY, data);
}

const testDataMiddleware = store => next => (action) => {
  if (!action.meta) {
    return next(action);
  }

  const consumed = { ...action };
  delete consumed.meta;

  switch (action.type) {
    case angular.types.DUMMY:
      dummy(store, { ...action.meta });
      return next(consumed);
    default:
      break;
  }

  return next(action);
};

export default () => {
  const reducer = combineReducers({
    pushes: pushes.reducer,
  });
  const store = createStore(reducer, applyMiddleware(testDataMiddleware));
  const actions = {
    pushes: bindActionCreators(pushes.actions, store.dispatch),
  };

  return { store, actions };
};
