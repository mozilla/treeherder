import angular from 'angular';
import angularClipboardModule from 'angular-clipboard';
import uiBootstrap from 'angular1-ui-bootstrap4';
import uiRouter from '@uirouter/angularjs';
import 'ng-text-truncate-2';
import LocalStorageModule from 'angular-local-storage';
import { react2angular } from 'react2angular/index.es2015';

import treeherderModule from './treeherder';
import Login from '../shared/Login';

treeherderModule.component('login', react2angular(Login, ['user', 'setUser'], []));

export default angular.module('perf', [
  uiRouter,
  uiBootstrap,
  treeherderModule.name,
  angularClipboardModule.name,
  'ngTextTruncate',
  LocalStorageModule,
]);
