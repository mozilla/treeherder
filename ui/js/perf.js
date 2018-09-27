import angular from 'angular';
import angularClipboardModule from 'angular-clipboard';
import uiBootstrap from 'angular1-ui-bootstrap4';
import uiRouter from '@uirouter/angularjs';
import 'ng-text-truncate-2';
import LocalStorageModule from 'angular-local-storage';

import treeherderModule from './treeherder';

export default angular.module('perf', [
  uiRouter,
  uiBootstrap,
  treeherderModule.name,
  angularClipboardModule.name,
  'ngTextTruncate',
  LocalStorageModule,
]);
