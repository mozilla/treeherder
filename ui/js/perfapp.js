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
        url: '/alerts?id&status&framework&filter&hideImprovements',
        controller: 'AlertsCtrl'
    }).state('graphs', {
        title: 'Graphs',
        templateUrl: 'partials/perf/graphsctrl.html',
        url: '/graphs?timerange&series&highlightedRevisions&highlightAlerts&zoom&selected',
        controller: 'GraphsCtrl'
    }).state('compare', {
        templateUrl: 'partials/perf/comparectrl.html',
        url: '/compare?originalProject&originalRevision&newProject&newRevision&hideMinorChanges&framework&filter&showOnlyImportant&showOnlyConfidentw',
        controller: 'CompareResultsCtrl'
    }).state('comparesubtest', {
        templateUrl: 'partials/perf/comparesubtestctrl.html',
        url: '/comparesubtest?originalProject&originalRevision&newProject&newRevision&originalSignature&newSignature&filter&showOnlyImportant&showOnlyConfident',
        controller: 'CompareSubtestResultsCtrl'
    }).state('comparechooser', {
        title: 'Compare',
        templateUrl: 'partials/perf/comparechooserctrl.html',
        url: '/comparechooser?originalProject&originalRevision&newProject&newRevision',
        controller: 'CompareChooserCtrl'
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
