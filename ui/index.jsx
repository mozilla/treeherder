import React from 'react';
import { render } from 'react-dom';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';
import { configureStore, history } from './job-view/redux/configureStore';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder.css';

import App from './App';

render(
  <Provider store={configureStore()}>
    <ConnectedRouter history={history}>
      <App />
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root'),
);
