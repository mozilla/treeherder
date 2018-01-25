'use strict';


import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import 'font-awesome/css/font-awesome.css';
import LoginCallback from './js/auth/LoginCallback';
import './js/config';

const load = () => render((
    <AppContainer>
        <LoginCallback />
    </AppContainer>
), document.getElementById('root'));

if (module.hot) {
    module.hot.accept('./js/auth/LoginCallback', load);
}

load();
