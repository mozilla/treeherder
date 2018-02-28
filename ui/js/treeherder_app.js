import angularToArrayfilter from 'angular-toarrayfilter';
import hcMarked from 'angular-marked';
import ngReactModule from 'ngreact';
import ngRoute from 'angular-route';
import uiBootstrap from 'angular1-ui-bootstrap4';
import mcResizer from '../vendor/resizer';

import treeherderModule from './treeherder';

const treeherderApp = angular.module('treeherder.app', [
  treeherderModule.name,
  uiBootstrap,
  ngRoute,
  mcResizer,
  angularToArrayfilter,
  ngReactModule.name,
  hcMarked,
]);

treeherderApp.config(['$compileProvider', '$locationProvider', '$routeProvider', '$httpProvider',
    '$logProvider', '$resourceProvider', 'localStorageServiceProvider',
    function ($compileProvider, $locationProvider, $routeProvider, $httpProvider, $logProvider,
             $resourceProvider, localStorageServiceProvider) {
        // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);

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

        localStorageServiceProvider.setPrefix("treeherder");

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);

        $routeProvider
            .when('/jobs', {
                // see controllers/filters.js ``skipNextSearchChangeReload`` for
                // why we set this to false.
                reloadOnSearch: false
            })
            .when('/jobs/:tree', {
                reloadOnSearch: false
            })
            .otherwise({ redirectTo: '/jobs' });
    }]).run(require('./cache-templates'));

export default treeherderApp;
