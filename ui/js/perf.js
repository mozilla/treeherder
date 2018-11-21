import angular from 'angular';
import angularClipboardModule from 'angular-clipboard';
import uiBootstrap from 'angular1-ui-bootstrap4';
import uiRouter from '@uirouter/angularjs';
import 'ng-text-truncate-2';
import { react2angular } from 'react2angular/index.es2015';

import Login from '../shared/auth/Login';

import treeherderModule from './treeherder';

const perf = angular.module('perf', [
  uiRouter,
  uiBootstrap,
  treeherderModule.name,
  angularClipboardModule.name,
  'ngTextTruncate',
]);

perf.component('login', react2angular(Login, ['user', 'setUser'], []));

export default perf;
