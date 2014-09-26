'use strict';

treeherder.directive('thFilterCheckbox', [
    'thResultStatusInfo',
    function (thResultStatusInfo) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.checkClass = thResultStatusInfo(scope.filterName).btnClass + "-count-classified";
        },
        templateUrl: 'partials/main/thFilterCheckbox.html'
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
        "unsupported": {
            icon: "",
            color: "treeUnavailable",
            btnClass: "btn-view-nav"
        },
        "not retrieved yet": {
            icon: "",
            color: "treeUnavailable",
            btnClass: "btn-view-nav"
        }
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {

            scope.updateTitleText = function() {
                if (scope.repoData.treeStatus) {
                    scope.titleText = scope.repoData.treeStatus.status;
                    if (scope.repoData.treeStatus.message_of_the_day) {
                        scope.titleText = scope.titleText + ' - ' +
                            scope.repoData.treeStatus.message_of_the_day;
                    }
                }
            };

            scope.btnClass = "btn-view-nav";

            scope.$watch('repoData.treeStatus.status', function(newVal) {
                if (newVal) {
                    $log.debug("updated treeStatus", newVal);
                    var si = statusInfo[newVal];
                    scope.statusIcon = si.icon;
                    scope.statusColor = si.color;
                    scope.btnClass = si.btnClass;
                    scope.updateTitleText();
                }
            });
        },
        templateUrl: 'partials/main/thWatchedRepo.html'
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

treeherder.directive('thRepoMenuItem', [
    'ThLog',
    function (ThLog) {

    var $log = new ThLog("thRepoDropdownContainer");

    return {
        restrict: "E",
        replace: true,
        link: function(scope, element, attrs) {
            var elem = $(element);
            elem.find('.repo-link').prop('href', "./#/jobs?repo=" +  scope.repo.name);
            if (scope.repo.name === scope.repoName) {
                elem.find('.repo-checkbox').prop('disabled', 'disabled');
            }

        },
        templateUrl: 'partials/main/thRepoMenuItem.html'
    };
}]);
