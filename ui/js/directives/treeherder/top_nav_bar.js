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
                color: "tree-open",
                btnClass: "btn-view-nav"
            },
            "approval required": {
                icon: "fa-lock",
                color: "tree-approval",
                btnClass: "btn-view-nav"
            },
            "closed": {
                icon: "fa-times-circle",
                color: "tree-closed",
                btnClass: "btn-view-nav-closed"
            },
            "unsupported": {
                icon: "fa-question",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            },
            "not retrieved yet": {
                icon: "fa-spinner",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            },
            "error": {
                icon: "fa-question",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            }
        };

        return {
            restrict: "E",
            link: function(scope, element, attrs) {

                scope.updateTitleText = function() {
                    if (scope.repoData.treeStatus) {
                        scope.titleText = scope.repoData.treeStatus.status;
                        if (scope.repoData.treeStatus.reason) {
                            scope.titleText = scope.titleText + ' - ' +
                                scope.repoData.treeStatus.reason;
                        }
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

treeherder.directive('thWatchedRepoInfoDropDown', [
    'ThLog', 'ThRepositoryModel', 'treeStatus',
    function (ThLog, ThRepositoryModel, treeStatus) {

        return {
            restrict: "E",
            replace: true,
            link: function(scope, element, attrs) {
                scope.name = attrs.name;
                scope.treeStatus = treeStatus.getTreeStatusName(attrs.name);
                var repo_obj = ThRepositoryModel.getRepo(attrs.name);
                scope.pushlog = repo_obj.pushlogURL;
                scope.$watch('repoData.treeStatus', function (newVal) {
                    if (newVal) {
                        scope.reason = newVal.reason;
                        scope.message_of_the_day = newVal.message_of_the_day;
                    }
                }, true);
            },
            templateUrl: 'partials/main/thWatchedRepoInfoDropDown.html'
        };
    }]);


treeherder.directive('thCheckboxDropdownContainer', [
    'ThLog', '$rootScope', 'thEvents',
    function (ThLog, $rootScope, thEvents) {

        var $log = new ThLog("thCheckboxDropdownContainer");

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

                $('.checkbox-dropdown-menu').on({
                    "click": function(ev) {
                        if ($(ev.target).hasClass("dropdown-link") ||
                            $(ev.target).parent().hasClass("dropdown-link")) {
                            scope.closeable = false;
                        }
                        $log.debug("menu dropdown", "click", scope.closeable, ev.target.className);
                    }
                });

            }
        };
    }]);

treeherder.directive('thRepoMenuItem', [
    'ThLog',
    function (ThLog) {

        var $log = new ThLog("thRepoMenuItem");

        return {
            restrict: "E",
            replace: true,
            link: function(scope, element, attrs) {
                var elem = $(element);
                elem.find('.dropdown-link').prop('href', scope.urlBasePath + "?repo=" + scope.repo.name);
                if (scope.repo.name === scope.repoName) {
                    elem.find('.dropdown-checkbox').prop('disabled', 'disabled');
                }

            },
            templateUrl: 'partials/main/thRepoMenuItem.html'
        };
    }]);

// which class to show for the show/hide excluded jobs button.
// this allows us to do one-time binding in the html.
treeherder.directive('thExclusionState', function () {
    return {
        restrict: "A",
        link: function(scope, element, attrs) {
            scope.exclusionStateClass = 'fa-square-o';
            if (scope.isSkippingExclusionProfiles) {
                scope.exclusionStateClass = 'fa-square';
            }
        }
    };
});

treeherder.directive('thResultStatusChicklet', [
    'thResultStatusInfo', function (thResultStatusInfo) {
        return {
            restrict: "E",
            link: function(scope, element, attrs) {
                scope.chickletClass = thResultStatusInfo(scope.filterName).btnClass +
                    "-filter-chicklet";
            },
            templateUrl: 'partials/main/thResultStatusChicklet.html'
        };
    }
]);
