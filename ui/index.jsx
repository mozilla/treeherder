import React from 'react';
import { render } from 'react-dom';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';

import { configureStore, history } from './job-view/redux/configureStore';
import App from './App';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder.css';

render(
  <Provider store={configureStore()}>
    <ConnectedRouter history={history}>
      <App />
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root'),
);
