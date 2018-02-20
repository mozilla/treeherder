import { getBtnClass } from '../../../helpers/jobHelper';

treeherder.directive('thWatchedRepo', [
    'ThLog', 'ThRepositoryModel',
    function (ThLog, ThRepositoryModel) {

        var $log = new ThLog("thWatchedRepo");

        var statusInfo = {
            open: {
                icon: "fa-circle-o",
                color: "tree-open",
                btnClass: "btn-view-nav"
            },
            "approval required": {
                icon: "fa-lock",
                color: "tree-approval",
                btnClass: "btn-view-nav"
            },
            closed: {
                icon: "fa-times-circle",
                color: "tree-closed",
                btnClass: "btn-view-nav-closed"
            },
            unsupported: {
                icon: "fa-question",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            },
            "not retrieved yet": {
                icon: "fa-spinner",
                iconClass: "fa-pulse",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            },
            error: {
                icon: "fa-question",
                color: "tree-unavailable",
                btnClass: "btn-view-nav"
            }
        };

        return {
            restrict: "E",
            link: function (scope) {

                scope.repoData = ThRepositoryModel.repos[scope.watchedRepo];

                scope.updateTitleText = function () {
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

                scope.$watch('repoData.treeStatus.status', function (newVal) {
                    if (newVal) {
                        $log.debug("updated treeStatus", newVal);
                        var si = statusInfo[newVal];
                        scope.statusIcon = si.icon;
                        scope.statusIconClass = si.iconClass || "";
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
    'ThRepositoryModel', 'treeStatus',
    function (ThRepositoryModel, treeStatus) {

        return {
            restrict: "E",
            replace: true,
            link: function (scope, element, attrs) {
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
    'ThLog',
    function (ThLog) {

        var $log = new ThLog("thCheckboxDropdownContainer");

        return {
            restrict: "A",
            link: function (scope, element) {

                scope.closeable = true;
                $(element).on({
                    "hide.bs.dropdown": function (ev) {
                        $log.debug("repo menu container", "hide.bs.dropdown", scope.closeable, ev.target.className);
                        var closeable = scope.closeable;
                        scope.closeable = true;
                        return closeable;
                    }
                });

                $('.checkbox-dropdown-menu').on({
                    click: function (ev) {
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

treeherder.directive('thRepoMenuItem',
    function () {

        return {
            restrict: "E",
            replace: true,
            link: function (scope, element) {
                var elem = $(element);
                elem.find('.dropdown-link').prop('href', scope.urlBasePath + "?repo=" + scope.repo.name);
                if (scope.repo.name === scope.repoName) {
                    elem.find('.dropdown-checkbox').prop('disabled', 'disabled');
                }

            },
            templateUrl: 'partials/main/thRepoMenuItem.html'
        };
    });

treeherder.directive('thResultStatusChicklet', function () {
    return {
        restrict: "E",
        link: function (scope) {
            scope.chickletClass = `${getBtnClass(scope.filterName)}-filter-chicklet`;
        },
        templateUrl: 'partials/main/thResultStatusChicklet.html'
    };
});
