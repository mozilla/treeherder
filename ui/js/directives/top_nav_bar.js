'use strict';

treeherder.directive('thGlobalTopNavPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thGlobalTopNavPanel.html'
    };
});

treeherder.directive('thWatchedRepoPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thWatchedRepoPanel.html'
    };
});

treeherder.directive('thFilterPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thFilterPanel.html'
    };
});

treeherder.directive('thRepoPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thRepoPanel.html'
    };
});

treeherder.directive('thFilterCheckbox', function (thResultStatusInfo) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.checkClass = thResultStatusInfo(scope.filterName).btnClass + "-count-classified";
        },
        templateUrl: 'partials/thFilterCheckbox.html'
    };
});

