import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';

import '../css/treeherder-test-view.css';
import { store, actions } from './redux/store';
import App from './ui/App';

render(
  <Provider store={store}>
    <App actions={actions} />
  </Provider>,
  document.getElementById('root'),
);
