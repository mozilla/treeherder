'use strict';

treeherder.directive('thActionButton', function () {
    return {
        restrict: "E",
        templateUrl: 'partials/main/thActionButton.html'
    };
});

treeherder.directive('thResultCounts', [
    'thEvents', '$rootScope', function (thEvents, $rootScope) {

        return {
            restrict: "E",
            link: function(scope) {
                var setTotalCount = function() {
                    if (scope.resultset.job_counts) {
                        scope.inProgress = scope.resultset.job_counts.pending +
                            scope.resultset.job_counts.running;
                        var total = scope.resultset.job_counts.completed + scope.inProgress;
                        scope.percentComplete = total > 0 ? ((scope.resultset.job_counts.completed / total) * 100).toFixed(0) : undefined;
                        scope.resultset.job_counts.percentComplete = scope.percentComplete;
                    }
                };

                $rootScope.$on(thEvents.applyNewJobs, function(evt, resultSetId) {
                    if (resultSetId === scope.resultset.id) {
                        setTotalCount();
                    }
                });

            },
            templateUrl: 'partials/main/thResultCounts.html'
        };
    }]);

treeherder.directive('thAuthor', function () {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            var userTokens = attrs.author.split(/[<>]+/);
            var email = "";
            if (userTokens.length > 1) {
                email = userTokens[1];
            }
            scope.authorName = userTokens[0].trim();
            scope.authorEmail = email;
        },
        template: '<span title="View resultsets for {{authorName}}: {{authorEmail}}">' +
            '<a href="{{authorResultsetFilterUrl}}"' +
            'ignore-job-clear-on-click>{{authorName}}</a></span>'
    };
});

