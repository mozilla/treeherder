"use strict";

// configure the router here, after we have defined all the controllers etc
perf.config(['$compileProvider', '$httpProvider', '$stateProvider', '$urlRouterProvider',
    function($compileProvider, $httpProvider, $stateProvider, $urlRouterProvider) {
        // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);

        $stateProvider.state('alerts', {
            title: 'Alerts',
            templateUrl: 'partials/perf/alertsctrl.html',
            url: '/alerts?id&status&framework&filter&hideImprovements&hideTo&page',
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
        }).state('e10s_trend', {
            title: 'e10s trend dashboard',
            templateUrl: 'partials/perf/e10s-trend.html',
            url: '/e10s-trend?filter&showOnlyImportant&showOnlyConfident&showOnlyBlockers&repo&basedate&newdate&timerange&revision',
            controller: 'e10sTrendCtrl'
        }).state('e10s_trendsubtest', {
            templateUrl: 'partials/perf/e10s-trend-subtest.html',
            url: '/e10s_trendsubtest?filter&showOnlyImportant&showOnlyConfident&showOnlyBlockers&repo&basedate&newdate&timerange&revision&baseSignature&e10sSignature',
            controller: 'e10sTrendSubtestCtrl'
        }).state('dashboard', {
            title: 'Perfherder Dashboard',
            templateUrl: 'partials/perf/dashboard.html',
            url: '/dashboard?topic&filter&showOnlyImportant&showOnlyConfident&showOnlyBlockers&repo&timerange&revision',
            controller: 'dashCtrl'
        }).state('dashboardsubtest', {
            templateUrl: 'partials/perf/dashboardsubtest.html',
            url: '/dashboardsubtest?topic&filter&showOnlyImportant&showOnlyConfident&baseSignature&variantSignature&repo&timerange&revision',
            controller: 'dashSubtestCtrl'
        });

        $urlRouterProvider.otherwise('/graphs');
    }]).run(['$rootScope', '$state', '$stateParams',
        function ($rootScope, $state, $stateParams) {
            $rootScope.$state = $state;
            $rootScope.$stateParams = $stateParams;

            $rootScope.$on('$stateChangeSuccess', function() {
                if ($state.current.title) {
                    window.document.title = $state.current.title;
                }
            });
        }]);
