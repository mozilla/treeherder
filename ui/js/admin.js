'use strict';

/*exported admin*/
var admin = angular.module('admin', [
    'ui.router', 'ui.bootstrap', 'treeherder', 'react'
]);

admin.config(function($compileProvider, $httpProvider, $stateProvider, $urlRouterProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.useApplyAsync(true);

    $stateProvider
        .state('profiles', {
            templateUrl: 'partials/admin/profiles_list.html',
            url: '/profiles',
            controller: 'ProfilesListCtrl'
        })
        .state('profiles_detail', {
            templateUrl: 'partials/admin/profiles_detail.html',
            url: '/profiles/:id',
            controller: 'ProfilesDetailCtrl'
        })
        .state('exclusions', {
            templateUrl: 'partials/admin/exclusions_list.html',
            url: '/exclusions',
            controller: 'ExclusionsListCtrl'
        })
        .state('exclusions_detail', {
            templateUrl: 'partials/admin/exclusions_detail.html',
            url: '/exclusions/:id',
            controller: 'ExclusionsDetailCtrl'
        });

    $urlRouterProvider.otherwise('/profiles');
});
