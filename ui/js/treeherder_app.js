import angular from 'angular';

import treeherderModule from './treeherder';

const treeherderApp = angular.module('treeherder.app', [
  treeherderModule.name,
]);

treeherderApp.config(['$compileProvider',
    function ($compileProvider) {
        // Disable debug data & legacy comment/class directive syntax, as recommended by:
        // https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);
        $compileProvider.commentDirectivesEnabled(false);
        $compileProvider.cssClassDirectivesEnabled(false);
    }]);

export default treeherderApp;
