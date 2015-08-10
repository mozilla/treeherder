'use strict';

treeherder.directive('thActionButton', [
    '$compile', 'thCloneHtml', 'ThResultSetStore',
    function ($compile, thCloneHtml, ThResultSetStore) {

        return {
            restrict: "E",
            templateUrl: 'partials/main/thActionButton.html',
            link: function(scope, element, attrs) {
                var openRevisions = function() {
                    var interpolator = thCloneHtml.get('revisionUrlClone').interpolator;
                    var htmlStr = '';
                    _.forEach(scope.resultset.revisions, function(revision) {
                        htmlStr = interpolator({
                            revisionUrl: scope.currentRepo.getRevisionHref(revision.revision)
                        }) + htmlStr;
                    });
                    var el = $compile(interpolator(scope))(scope, function(el, scope) {
                        var wnd = window.open(
                            '',
                            scope.repoName,
                            "outerHeight=250,outerWidth=500,toolbar=no,location=no,menubar=no"
                        );
                        wnd.document.write(htmlStr);
                    });
                };

                scope.openRevisionListWindow = function() {
                    if (!scope.resultset.revisions.length) {
                        ThResultSetStore.loadRevisions(
                            scope.repoName, scope.resultset.id
                        ).then(function() {
                            openRevisions();
                        });
                    } else {
                        openRevisions();
                    }
                };

            }
        };
    }]);

treeherder.directive('thResultCounts', [
    'thEvents', '$rootScope', function (thEvents, $rootScope) {

        return {
            restrict: "E",
            link: function(scope, element, attrs) {
                var setTotalCount = function() {
                    if (scope.resultset.job_counts) {

                        scope.inProgress = scope.resultset.job_counts.pending +
                            scope.resultset.job_counts.running;
                        var total = scope.resultset.job_counts.completed + scope.inProgress;
                        scope.percentComplete = ((scope.resultset.job_counts.completed / total) * 100).toFixed(0);
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

