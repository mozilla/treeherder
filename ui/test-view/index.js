import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { AppContainer } from 'react-hot-loader';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.css';
import './global.css';
import { store, actions } from './redux/store';
import App from './ui/App';

const load = () => render((
  <AppContainer>
    <Provider store={store}>
      <App actions={actions} />
    </Provider>
  </AppContainer>
), document.getElementById('root'));

if (module.hot) {
  module.hot.accept('./ui/App', load);
}

load();
