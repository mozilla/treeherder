import $ from 'jquery';

import treeherder from '../../treeherder';
import thWatchedRepoTemplate from '../../../partials/main/thWatchedRepo.html';
import thWatchedRepoInfoDropDownTemplate from '../../../partials/main/thWatchedRepoInfoDropDown.html';
import thRepoMenuItemTemplate from '../../../partials/main/thRepoMenuItem.html';
import thResultStatusChickletTemplate from '../../../partials/main/thResultStatusChicklet.html';
import { getBtnClass } from '../../../helpers/jobHelper';
import TreeStatusModel from '../../../models/treeStatus';

treeherder.directive('thWatchedRepo', [
    'ThRepositoryModel',
    function (ThRepositoryModel) {

        const statusInfo = {
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
                        const si = statusInfo[newVal];
                        scope.statusIcon = si.icon;
                        scope.statusIconClass = si.iconClass || "";
                        scope.statusColor = si.color;
                        scope.btnClass = si.btnClass;
                        scope.updateTitleText();
                    }
                });
            },
            template: thWatchedRepoTemplate
        };
    }]);

treeherder.directive('thWatchedRepoInfoDropDown', [
    'ThRepositoryModel',
    function (ThRepositoryModel) {

        return {
            restrict: "E",
            replace: true,
            link: function (scope, element, attrs) {
                scope.name = attrs.name;
                scope.treeStatus = TreeStatusModel.getTreeStatusName(attrs.name);
                const repo_obj = ThRepositoryModel.getRepo(attrs.name);
                scope.pushlog = repo_obj.pushlogURL;
                scope.$watch('repoData.treeStatus', function (newVal) {
                    if (newVal) {
                        scope.reason = newVal.reason;
                        scope.message_of_the_day = newVal.message_of_the_day;
                    }
                }, true);
            },
            template: thWatchedRepoInfoDropDownTemplate
        };
    }]);


treeherder.directive('thCheckboxDropdownContainer', function () {

        return {
            restrict: "A",
            link: function (scope, element) {

                scope.closeable = true;
                $(element).on({
                    "hide.bs.dropdown": function () {
                        const closeable = scope.closeable;
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
                    }
                });

            }
        };
    });

treeherder.directive('thRepoMenuItem',
    function () {

        return {
            restrict: "E",
            replace: true,
            link: function (scope, element) {
                const elem = $(element);
                elem.find('.dropdown-link').prop('href', scope.urlBasePath + "?repo=" + scope.repo.name);
                if (scope.repo.name === scope.repoName) {
                    elem.find('.dropdown-checkbox').prop('disabled', 'disabled');
                }

            },
            template: thRepoMenuItemTemplate
        };
    });

treeherder.directive('thResultStatusChicklet', function () {
    return {
        restrict: "E",
        link: function (scope) {
            scope.chickletClass = `${getBtnClass(scope.filterName)}-filter-chicklet`;
        },
        template: thResultStatusChickletTemplate
    };
});
