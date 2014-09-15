'use strict';

treeherder.directive('thFilterCheckbox', [
    'thResultStatusInfo',
    function (thResultStatusInfo) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.checkClass = thResultStatusInfo(scope.filterName).btnClass + "-count-classified";
        },
        templateUrl: 'partials/thFilterCheckbox.html'
    };
}]);

treeherder.directive('thWatchedRepo', [
    'ThLog',
    function (ThLog) {

    var $log = new ThLog("thWatchedRepo");

    var statusInfo = {
        "open": {
            icon: "fa-circle-o",
            color: "treeOpen",
            btnClass: "btn-view-nav"
        },
        "approval required": {
            icon: "fa-lock",
            color: "treeApproval",
            btnClass: "btn-view-nav"
        },
        "closed": {
            icon: "fa-times-circle",
            color: "treeClosed",
            btnClass: "btn-view-nav-closed"
        },
        "unavailable": {
            icon: "",
            color: "treeUnavailable",
            btnClass: "btn-view-nav"
        }
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {

            scope.updateCount = function() {
                if (scope.repoData.groupName !== "try") {
                    scope.adjustedUnclassifiedFailureCount = scope.getTimeWindowUnclassifiedFailureCount(
                        scope.name);
                }
            };

            scope.updateTitleText = function() {
                if (scope.repoData.treeStatus) {
                    scope.titleText = scope.repoData.treeStatus.status;
                    if (scope.adjustedUnclassifiedFailureCount > 0 &&
                        scope.repoData.groupName !== "try") {
                        scope.titleText = scope.titleText + ' - ' +
                            scope.adjustedUnclassifiedFailureCount +
                            " unclassified failures in last 24 hours";
                    }
                    if (scope.repoData.treeStatus.message_of_the_day) {
                        scope.titleText = scope.titleText + ' - ' +
                            scope.repoData.treeStatus.message_of_the_day;
                    }
                }
            };

            scope.btnClass = "btn-view-nav";

            scope.$watch('repoData', function(newVal) {
                if (newVal.treeStatus) {
                    $log.debug("updated treeStatus", newVal.treeStatus.status);
                    scope.statusIcon = statusInfo[newVal.treeStatus.status].icon;
                    scope.statusColor = statusInfo[newVal.treeStatus.status].color;
                    scope.btnClass = statusInfo[newVal.treeStatus.status].btnClass;
                    scope.updateCount();
                    scope.updateTitleText();
                }
            }, true);

            scope.$watch('isSkippingExclusionProfiles()', function(newVal) {
                scope.updateCount();
                scope.updateTitleText();
            });

        },
        templateUrl: 'partials/thWatchedRepo.html'
    };
}]);

treeherder.directive('thRepoDropdownContainer', [
    'ThLog', '$rootScope', 'thEvents',
    function (ThLog, $rootScope, thEvents) {

    var $log = new ThLog("thRepoDropdownContainer");

    return {
        restrict: "A",
        link: function(scope, element, attrs) {

            scope.closeable = true;
            $(element).on({
                "hide.bs.dropdown": function(ev) {
                    $log.debug("repo menu container", "hide.bs.dropdown", scope.closeable, ev.target.className);
                    var closeable = scope.closeable;
                    scope.closeable = true;
                    return closeable;
                }
            });

            $('.repo-dropdown-menu').on({
                "click": function(ev) {
                    if ($(ev.target).hasClass(".repo-link") || $(ev.target).hasClass(".repo-checkbox")) {
                        scope.closeable = false;
                    }
                    $log.debug("repo menu dropdown", "click", scope.closeable, ev.target.className);
                },
                "mouseup": function(ev) {
                    scope.closeable = false;
                    $log.debug("repo menu dropdown", "mouseup", scope.closeable, ev.target.className);
                }
            });

        }
    };
}]);
