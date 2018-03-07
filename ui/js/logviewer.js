import angular from 'angular';

import treeherderModule from './treeherder';

const logViewerApp = angular.module('logviewer', [treeherderModule.name]);

logViewerApp.config(['$compileProvider', '$locationProvider', '$resourceProvider',
    function ($compileProvider, $locationProvider, $resourceProvider) {
        // Disable debug data & legacy comment/class directive syntax, as recommended by:
        // https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);
        $compileProvider.commentDirectivesEnabled(false);
        $compileProvider.cssClassDirectivesEnabled(false);

        // Revert to the legacy Angular <=1.5 URL hash prefix to save breaking existing links:
        // https://docs.angularjs.org/guide/migration#commit-aa077e8
        $locationProvider.hashPrefix('');

        // Don't strip trailing slashes from calculated URLs
        $resourceProvider.defaults.stripTrailingSlashes = false;

        // All queries should be cancellable by default (why is this configurable??)
        $resourceProvider.defaults.cancellable = true;
    }]);

export default logViewerApp;
