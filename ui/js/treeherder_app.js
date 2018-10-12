import angular from 'angular';
import uiBootstrap from 'angular1-ui-bootstrap4';

import treeherderModule from './treeherder';

const treeherderApp = angular.module('treeherder.app', [
  treeherderModule.name,
  uiBootstrap,
]);

treeherderApp.config(['$compileProvider', '$httpProvider',
    function ($compileProvider, $httpProvider) {
        // Disable debug data & legacy comment/class directive syntax, as recommended by:
        // https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);
        $compileProvider.commentDirectivesEnabled(false);
        $compileProvider.cssClassDirectivesEnabled(false);

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);
    }]);

export default treeherderApp;
