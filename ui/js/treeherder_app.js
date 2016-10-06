'use strict';

var treeherderApp = angular.module('treeherder.app',
                                   ['treeherder', 'ui.bootstrap', 'ngRoute',
                                    'mc.resizer', 'angular-toArrayFilter']);

treeherderApp.config(function($compileProvider, $routeProvider,
                              $httpProvider, $logProvider, $resourceProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);

    // Don't strip trailing slashes from calculated URLs
    $resourceProvider.defaults.stripTrailingSlashes = false;

    // All queries should be cancellable by default (why is this configurable??)
    $resourceProvider.defaults.cancellable = true;

    // enable or disable debug messages using $log.
    // comment out the next line to enable them
    $logProvider.debugEnabled(false);

    // avoid CORS issue when getting the logs from the ftp site
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.useApplyAsync(true);

    $routeProvider.
        when('/jobs', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/main/jobs.html',
            // see controllers/filters.js ``skipNextSearchChangeReload`` for
            // why we set this to false.
            reloadOnSearch: false
        }).
        when('/jobs/:tree', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/main/jobs.html',
            reloadOnSearch: false
        }).
        when('/login', {
            resolve: {redirect: 'loginCallback'}
        }).
        otherwise({redirectTo: '/jobs'});
});
