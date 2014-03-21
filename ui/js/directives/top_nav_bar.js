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

treeherder.directive('thWatchedRepo', function ($log) {
    var logId = "thWatchedRepo";

    var statusInfo = {
        "open": {
            icon: "fa-circle-o",
            color: "treeOpen"
        },
        "approval required": {
            icon: "fa-key",
            color: "treeApproval"
        },
        "closed": {
            icon: "fa-ban",
            color: "treeClosed"
        }
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            $log.debug(logId, "repoData", scope.repoData);
//            scope.statusIcon = icons[scope.repoData.treeStatus.status];
            scope.$watch('repoData', function(newVal) {
                if (newVal) {
                    $log.debug(logId, "updated treeStatus", newVal.treeStatus.status);
                    scope.statusIcon = statusInfo[newVal.treeStatus.status].icon;
                    scope.statusColor = statusInfo[newVal.treeStatus.status].color;
                    scope.titleText = newVal.treeStatus.message_of_the_day;
                }
            }, true);

        },
        templateUrl: 'partials/thWatchedRepo.html'
    };
});

