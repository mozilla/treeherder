import perf from './perf';

// configure the router here, after we have defined all the controllers etc
perf.config(['$compileProvider', '$locationProvider', '$httpProvider', '$stateProvider', '$urlRouterProvider',
    function ($compileProvider, $locationProvider, $httpProvider, $stateProvider, $urlRouterProvider) {
        // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);

        // Revert to the legacy Angular <=1.5 pre-assign bindings behaviour:
        // https://docs.angularjs.org/guide/migration#commit-bcd0d4
        // TODO: Move component/directive controller initialization logic that relies on bindings
        // being present (eg that in phCompareTable) into the controller's $onInit() instead.
        $compileProvider.preAssignBindingsEnabled(true);

        // Revert to the legacy Angular <=1.5 URL hash prefix to save breaking existing links:
        // https://docs.angularjs.org/guide/migration#commit-aa077e8
        $locationProvider.hashPrefix('');

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);

        $stateProvider
            .state('alerts', {
                title: 'Alerts',
                templateUrl: 'partials/perf/alertsctrl.html',
                url: '/alerts?id&status&framework&filter&hideImprovements&hideDwnToInv&page',
                controller: 'AlertsCtrl'
            })
            .state('graphs', {
                title: 'Graphs',
                templateUrl: 'partials/perf/graphsctrl.html',
                url: '/graphs?timerange&series&highlightedRevisions&highlightAlerts&zoom&selected',
                controller: 'GraphsCtrl'
            })
            .state('compare', {
                title: 'Compare',
                templateUrl: 'partials/perf/comparectrl.html',
                url: '/compare?originalProject&originalRevision?&newProject&newRevision&hideMinorChanges&framework&filter&showOnlyImportant&showOnlyConfident&selectedTimeRange&showOnlyNoise?',
                controller: 'CompareResultsCtrl'
            })
            .state('comparesubtest', {
                title: 'Compare - Subtests',
                templateUrl: 'partials/perf/comparesubtestctrl.html',
                url: '/comparesubtest?originalProject&originalRevision?&newProject&newRevision&originalSignature&newSignature&filter&showOnlyImportant&showOnlyConfident&framework&selectedTimeRange&showOnlyNoise?',
                controller: 'CompareSubtestResultsCtrl'
            })
            .state('comparechooser', {
                title: 'Compare Chooser',
                templateUrl: 'partials/perf/comparechooserctrl.html',
                url: '/comparechooser?originalProject&originalRevision&newProject&newRevision',
                controller: 'CompareChooserCtrl'
            })
            .state('dashboard', {
                title: 'Perfherder Dashboard',
                templateUrl: 'partials/perf/dashboard.html',
                url: '/dashboard?topic&filter&showOnlyImportant&showOnlyConfident&showOnlyBlockers&repo&timerange&revision',
                controller: 'dashCtrl'
            })
            .state('dashboardsubtest', {
                title: 'Perfherder Dashboard - Subtests',
                templateUrl: 'partials/perf/dashboardsubtest.html',
                url: '/dashboardsubtest?topic&filter&showOnlyImportant&showOnlyConfident&baseSignature&variantSignature&repo&timerange&revision',
                controller: 'dashSubtestCtrl'
            })
            .state('comparesubtestdistribution', {
                title: 'Compare Subtest Distribution',
                templateUrl: 'partials/perf/comparesubtestdistribution.html',
                url: '/comparesubtestdistribution?originalProject&newProject&originalRevision&newRevision&originalSubtestSignature?newSubtestSignature',
                controller: 'CompareSubtestDistributionCtrl'
            });
        $urlRouterProvider.otherwise('/graphs');
    }]).run(['$rootScope', '$state', '$stateParams', function ($rootScope, $state, $stateParams) {
        $rootScope.$state = $state;
        $rootScope.$stateParams = $stateParams;

        $rootScope.$on('$stateChangeSuccess', function () {
            if ($state.current.title) {
                window.document.title = $state.current.title;
            }
        });
    }]).run(require('./cache-templates'));
