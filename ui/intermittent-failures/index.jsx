import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';

import '../css/treeherder-global.css';
import '../css/intermittent-failures.css';
import App from './App';
import store from './redux/store';

function load() {
  render((
    <AppContainer>
      <App store={store} />
    </AppContainer>
  ), document.getElementById("root"));
}

load();

if (module.hot) {
  module.hot.accept('./App', () => load(App));
}
