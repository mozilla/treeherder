import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

import './css/treeherder-custom-styles.css';
import './css/treeherder-navbar.css';
import './css/treeherder.css';

import App from './App';

render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById('root'),
);
