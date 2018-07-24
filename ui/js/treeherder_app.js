import angular from 'angular';
import hcMarked from 'angular-marked';
import ngRoute from 'angular-route';
import uiBootstrap from 'angular1-ui-bootstrap4';

import treeherderModule from './treeherder';
import thShortcutTableTemplate from '../partials/main/thShortcutTable.html';

const treeherderApp = angular.module('treeherder.app', [
  treeherderModule.name,
  uiBootstrap,
  ngRoute,
  // Remove when `ui/partials/main/tcjobactions.html` converted to React.
  hcMarked,
]);

treeherderApp.config(['$compileProvider', '$locationProvider', '$routeProvider', '$httpProvider',
    '$logProvider', '$resourceProvider',
    function ($compileProvider, $locationProvider, $routeProvider, $httpProvider, $logProvider,
             $resourceProvider) {
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

        // enable or disable debug messages using $log.
        // comment out the next line to enable them
        $logProvider.debugEnabled(false);

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);

        $routeProvider
            .when('/jobs', {
                // see controllers/main.js ``skipNextPageReload`` for
                // why we set this to false.
                reloadOnSearch: false,
            })
            .when('/jobs/:tree', {
                reloadOnSearch: false,
            })
            .otherwise({ redirectTo: '/jobs' });
    }]).run(['$templateCache', ($templateCache) => {
        // Templates used by ng-include have to be manually put in the template cache.
        // Those used by directives should instead be imported at point of use.
        $templateCache.put('partials/main/thShortcutTable.html', thShortcutTableTemplate);
    }]);

export default treeherderApp;
