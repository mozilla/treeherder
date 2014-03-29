'use strict';

treeherder.directive('thFilterCheckbox', function (thResultStatusInfo) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.checkClass = thResultStatusInfo(scope.filterName).btnClass + "-count-classified";
        },
        templateUrl: 'partials/thFilterCheckbox.html'
    };
});

treeherder.directive('thWatchedRepo', function (ThLog, ThRepositoryModel) {
    var $log = new ThLog("thWatchedRepo");

    var statusInfo = {
        "open": {
            icon: "fa-circle-o",
            color: "treeOpen"
        },
        "approval required": {
            icon: "fa-lock",
            color: "treeApproval"
        },
        "closed": {
            icon: "fa-times-circle",
            color: "treeClosed"
        },
        "unavailable": {
            icon: "fa-chain-broken",
            color: "treeUnavailable"
        }
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {

            scope.$watch('repoData.treeStatus', function(newVal) {
                if (newVal) {
                    $log.debug("updated treeStatus", newVal.status);
                    scope.statusIcon = statusInfo[newVal.status].icon;
                    scope.statusColor = statusInfo[newVal.status].color;
                }
            }, true);

        },
        templateUrl: 'partials/thWatchedRepo.html'
    };
});

treeherder.directive('thRepoDropDown', function (ThLog, ThRepositoryModel) {
    var $log = new ThLog("thRepoDropDown");

    return {
        restrict: "E",
        replace: true,
        link: function(scope, element, attrs) {

            scope.name = attrs.name;
            var repo_obj = ThRepositoryModel.getRepo(attrs.name);
            scope.pushlog = repo_obj.url +"/pushloghtml";

            scope.$watch('repoData.treeStatus', function(newVal) {
                if (newVal) {
                    $log.debug("updated treeStatus", repo_obj, newVal);
                    scope.reason = newVal.reason;
                    scope.message_of_the_day = newVal.message_of_the_day;
                }
            }, true);

        },
        templateUrl: 'partials/thRepoDropDown.html'
    };
});
