'use strict';

var treeherder = angular.module('treeherder',
    ['ngResource','ui.bootstrap', 'ngSanitize', 'ngCookies', 'ngRoute',
     'LocalStorageModule']);

// dummy values required to use the library at: https://tbpl.mozilla.org/js/Config.js
// for the platform name conversion
window.BuildbotDBUser = "Treeherder";
window.PushlogJSONParser = "None";

treeherder.config(function($routeProvider, $httpProvider, $logProvider) {

    // enable or disable debug messages using $log.
    // comment out the next line to enable them
//    $logProvider.debugEnabled(false);

    // needed to avoid CORS issue when getting the logs from the ftp site
    // @@@ hack for now to get it to work in the short-term
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';

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
            controller: 'TimelineCtrl',
            templateUrl: 'partials/timeline.html'
        }).
        when('/machines', {
            controller: 'MachinesCtrl',
            templateUrl: 'partials/machines.html'
        }).
        otherwise({redirectTo: '/jobs'});
});


var logViewer = angular.module('logViewer',['treeherder']);
treeherder.config(function($httpProvider, $logProvider) {
    // enable or disable debug messages using $log.
    // comment out the next line to enable them
    $logProvider.debugEnabled(false);

    // needed to avoid CORS issue when getting the logs from the ftp site
    // @@@ hack for now to get it to work in the short-term
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
});
