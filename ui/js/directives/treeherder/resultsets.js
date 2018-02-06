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
            link: function (scope) {
                var setTotalCount = function () {
                    if (scope.resultset.job_counts) {
                        scope.inProgress = scope.resultset.job_counts.pending +
                            scope.resultset.job_counts.running;
                        var total = scope.resultset.job_counts.completed + scope.inProgress;
                        scope.percentComplete = total > 0 ?
                            Math.floor(((scope.resultset.job_counts.completed / total) * 100)) : undefined;
                    }
                };

                $rootScope.$on(thEvents.applyNewJobs, function (evt, resultSetId) {
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
        link: function (scope, element, attrs) {
            var authorMatch = attrs.author.match(/\<(.*?)\>+/);
            scope.authorEmail = authorMatch ? authorMatch[1] : attrs.author;
        },
        template: '<span title="View pushes by this user">' +
            '<a href="{{authorResultsetFilterUrl}}"' +
            'data-ignore-job-clear-on-click>{{authorEmail}}</a></span>'
    };
});

