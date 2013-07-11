'use strict';

var treeherder = angular.module('treeherder', ['ngResource','ui.bootstrap']);

treeherder.config(function($routeProvider) {

  $routeProvider.
      when('/jobs', {
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
      otherwise({redirectTo: '/jobs'})
});
