'use strict';

treeherder.directive('thActionButton', [
    '$compile', 'thCloneHtml', 'ThResultSetModel',
    function ($compile, thCloneHtml, ThResultSetModel) {

    return {
        restrict: "E",
        templateUrl: 'partials/thActionButton.html',
        link: function(scope, element, attrs) {
            var openRevisions = function() {
                var interpolator = thCloneHtml.get('revisionUrlClone').interpolator;
                var htmlStr = '';
                _.forEach(scope.resultset.revisions, function(revision) {
                    htmlStr = htmlStr + interpolator(
                        {repoUrl: scope.currentRepo.url, revision: revision}
                    );
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
                    ThResultSetModel.loadRevisions(
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

treeherder.directive('thResultCounts', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thResultCounts.html'
    };
});

treeherder.directive('thResultStatusCount', function () {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.resultCountText = scope.getCountText(scope.resultStatus);
            scope.resultStatusCountClassPrefix = scope.getCountClass(scope.resultStatus);

            // @@@ this will change once we have classifying implemented
            scope.resultCount = scope.resultset.job_counts[scope.resultStatus];
            scope.unclassifiedResultCount = scope.resultCount;
            var getCountAlertClass = function() {
                if (scope.unclassifiedResultCount) {
                    return scope.resultStatusCountClassPrefix + "-count-unclassified";
                } else {
                    return scope.resultStatusCountClassPrefix + "-count-classified";
                }
            };
            scope.countAlertClass = getCountAlertClass();

            scope.$watch("resultset.job_counts", function(newValue) {
                scope.resultCount = scope.resultset.job_counts[scope.resultStatus];
                scope.unclassifiedResultCount = scope.resultCount;
                scope.countAlertClass = getCountAlertClass();
            }, true);

        },
        templateUrl: 'partials/thResultStatusCount.html'
    };
});

treeherder.directive('thRevision', [
    '$parse',
    function($parse) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.$watch('resultset.revisions', function(newVal) {
                if (newVal) {
                    scope.revisionUrl = scope.currentRepo.url + "/rev/" + scope.revision.revision;
                }
            }, true);
        },
        templateUrl: 'partials/thRevision.html'
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
        template: '<span title="open resultsets for {{authorName}}: {{authorEmail}}">' +
                      '<a href="{{authorResultsetFilterUrl}}" ' +
                         'target="_blank">{{authorName}}</a></span>'
    };
});

