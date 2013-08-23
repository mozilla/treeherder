'use strict';

var treeherder = angular.module('treeherder',
    ['ngResource','ui.bootstrap', 'ngSanitize', 'treeherder.directives']);

treeherder.config(function($routeProvider, $httpProvider) {

    // needed to avoid CORS issue when getting the logs from the ftp site
    // @@@ hack for now to get it to work in the short-term
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $routeProvider.
        when('/jobs', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/jobs.html'
        }).
        when('/jobs/:tree', {
            controller: 'JobsCtrl',
            templateUrl: 'partials/jobs.html'
        }).
        when('/timeline', {
            controller: 'TimelineController',
            templateUrl: 'partials/timeline.html'
        }).
        when('/machines', {
            controller: 'MachinesController',
            templateUrl: 'partials/machines.html'
        }).
        otherwise({redirectTo: '/jobs'});
});
