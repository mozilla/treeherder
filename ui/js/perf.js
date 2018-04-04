import angular from 'angular';
import angularClipboardModule from 'angular-clipboard';
import uiBootstrap from 'angular1-ui-bootstrap4';
import uiRouter from 'angular-ui-router';
import 'ng-text-truncate-2';

import treeherderModule from './treeherder';

export default angular.module('perf', [
  uiRouter,
  uiBootstrap,
  treeherderModule.name,
  angularClipboardModule.name,
  'ngTextTruncate'
]);
