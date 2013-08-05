'use strict';

var treeherder = angular.module('treeherder', ['ngResource','ui.bootstrap']);

treeherder.config(function($routeProvider, $httpProvider) {

    // needed to avoid CORS issue when talking to REST endpoints on service.
    // @@@ todo: we need better CORS support on the service in the future
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
