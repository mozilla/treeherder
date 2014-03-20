'use strict';

treeherder.directive('thActionButton', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thActionButton.html'
    };
});

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

treeherder.directive('thRevision', function($parse) {

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
});

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

