"use strict";

// configure the router here, after we have defined all the controllers etc
perf.config(function($compileProvider, $httpProvider, $stateProvider, $urlRouterProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);

    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.useApplyAsync(true);

    $stateProvider.state('alerts', {
        title: 'Alerts',
        templateUrl: 'partials/perf/alertsctrl.html',
        url: '/alerts?id&status&framework&filter&hideImprovements&page',
        controller: 'AlertsCtrl'
    }).state('graphs', {
        title: 'Graphs',
        templateUrl: 'partials/perf/graphsctrl.html',
        url: '/graphs?timerange&series&highlightedRevisions&highlightAlerts&zoom&selected',
        controller: 'GraphsCtrl'
    }).state('compare', {
        templateUrl: 'partials/perf/comparectrl.html',
        url: '/compare?originalProject&originalRevision&newProject&newRevision&hideMinorChanges&framework&filter&showOnlyImportant&showOnlyConfident',
        controller: 'CompareResultsCtrl'
    }).state('comparesubtest', {
        templateUrl: 'partials/perf/comparesubtestctrl.html',
        url: '/comparesubtest?originalProject&originalRevision&newProject&newRevision&originalSignature&newSignature&filter&showOnlyImportant&showOnlyConfident&framework',
        controller: 'CompareSubtestResultsCtrl'
    }).state('comparechooser', {
        title: 'Compare',
        templateUrl: 'partials/perf/comparechooserctrl.html',
        url: '/comparechooser?originalProject&originalRevision&newProject&newRevision',
        controller: 'CompareChooserCtrl'
    }).state('e10s', {
        title: 'e10s talos dashboard',
        templateUrl: 'partials/perf/e10s.html',
        url: '/e10s?filter&showOnlyImportant&showOnlyConfident&showOnlyBlockers&repo&timerange&revision',
        controller: 'e10sCtrl'
    }).state('e10s_comparesubtest', {
        templateUrl: 'partials/perf/e10s-subtest.html',
        url: '/e10s_comparesubtest?filter&showOnlyImportant&showOnlyConfident&baseSignature&e10sSignature&repo&timerange&revision',
        controller: 'e10sSubtestCtrl'
    });

    $urlRouterProvider.otherwise('/graphs');
}).run(['$rootScope', '$state', '$stateParams',
        function ($rootScope, $state, $stateParams) {
            $rootScope.$state = $state;
            $rootScope.$stateParams = $stateParams;

            $rootScope.$on('$stateChangeSuccess', function() {
                if ($state.current.title) {
                    window.document.title = $state.current.title;
                }
            });
        }]);
