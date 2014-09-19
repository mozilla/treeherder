'use strict';

var treeherder = angular.module('treeherder',
    ['ngResource','ui.bootstrap', 'ngSanitize', 'ngCookies', 'ngRoute',
     'LocalStorageModule', 'mc.resizer']);


treeherder.config(function($routeProvider, $httpProvider, $logProvider) {

    // enable or disable debug messages using $log.
    // comment out the next line to enable them
    $logProvider.debugEnabled(false);

    // avoid CORS issue when getting the logs from the ftp site
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';

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
        when('/timeline', {
            controller: 'TimelineCtrl',
            templateUrl: 'partials/main/timeline.html'
        }).
        when('/machines', {
            controller: 'MachinesCtrl',
            templateUrl: 'partials/main/machines.html'
        }).
        otherwise({redirectTo: '/jobs'});
});

var logViewer = angular.module('logViewer',['treeherder']);
