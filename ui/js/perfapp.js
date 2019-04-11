// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names */
import alertsCtrlTemplate from '../partials/perf/alertsctrl.html';
import graphsCtrlTemplate from '../partials/perf/graphsctrl.html';
import compareCtrlTemplate from '../partials/perf/comparectrl.html';
import compareSubtestCtrlTemplate from '../partials/perf/comparesubtestctrl.html';
import compareChooserCtrlTemplate from '../partials/perf/comparechooserctrl.html';
import compareSubtestDistributionTemplate from '../partials/perf/comparesubtestdistribution.html';
import helpMenuTemplate from '../partials/perf/helpMenu.html';

import perf from './perf';

// configure the router here, after we have defined all the controllers etc
perf.config(['$compileProvider', '$locationProvider', '$httpProvider', '$stateProvider', '$urlRouterProvider',
    function ($compileProvider, $locationProvider, $httpProvider, $stateProvider, $urlRouterProvider) {
        // Disable debug data & legacy comment/class directive syntax, as recommended by:
        // https://docs.angularjs.org/guide/production
        $compileProvider.debugInfoEnabled(false);
        $compileProvider.commentDirectivesEnabled(false);
        $compileProvider.cssClassDirectivesEnabled(false);

        // Revert to the legacy Angular <=1.5 URL hash prefix to save breaking existing links:
        // https://docs.angularjs.org/guide/migration#commit-aa077e8
        $locationProvider.hashPrefix('');

        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.useApplyAsync(true);

        $stateProvider
            .state('alerts', {
                title: 'Alerts',
                template: alertsCtrlTemplate,
                url: '/alerts?id&status&framework&filter&hideImprovements&hideDwnToInv&page',
                // controller: 'AlertsCtrl',
            })
            .state('graphs', {
                title: 'Graphs',
                template: graphsCtrlTemplate,
                url: '/graphs?timerange&series&highlightedRevisions&highlightAlerts&zoom&selected',
                controller: 'GraphsCtrl',
            })
            .state('compare', {
                title: 'Compare',
                template: compareCtrlTemplate,
                url: '/compare?originalProject&originalRevision?&newProject&newRevision&hideMinorChanges&framework&filter&showOnlyComparable&showOnlyImportant&showOnlyConfident&selectedTimeRange&showOnlyNoise?',
            })
            .state('comparesubtest', {
                title: 'Compare - Subtests',
                template: compareSubtestCtrlTemplate,
                url: '/comparesubtest?originalProject&originalRevision?&newProject&newRevision&originalSignature&newSignature&filter&showOnlyComparable&showOnlyImportant&showOnlyConfident&framework&selectedTimeRange&showOnlyNoise?',
            })
            .state('comparechooser', {
                title: 'Compare Chooser',
                template: compareChooserCtrlTemplate,
                url: '/comparechooser?originalProject&originalRevision&newProject&newRevision',
            })
            .state('comparesubtestdistribution', {
                title: 'Compare Subtest Distribution',
                template: compareSubtestDistributionTemplate,
                url: '/comparesubtestdistribution?originalProject&newProject&originalRevision&newRevision&originalSubtestSignature?newSubtestSignature',
            });
        $urlRouterProvider.otherwise('/graphs');
    }]).run(['$rootScope', '$state', '$stateParams', function ($rootScope, $state, $stateParams) {
        $rootScope.$state = $state;
        $rootScope.$stateParams = $stateParams;
        $rootScope.user = { isLoggedIn: false };

        $rootScope.setUser = (user) => {
          $rootScope.user = user;
          $rootScope.$apply();
        };

        $rootScope.$on('$stateChangeSuccess', function () {
            if ($state.current.title) {
                window.document.title = $state.current.title;
            }
        });
    // Templates used by ng-include have to be manually put in the template cache.
    // Those used by directives should instead be imported at point of use.
    }]).run(['$templateCache', ($templateCache) => $templateCache.put('partials/perf/helpMenu.html', helpMenuTemplate)]);
