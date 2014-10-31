/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.directive('thActionButton', [
    '$compile', 'thCloneHtml', 'ThResultSetModel',
    function ($compile, thCloneHtml, ThResultSetModel) {

    return {
        restrict: "E",
        templateUrl: 'partials/main/thActionButton.html',
        link: function(scope, element, attrs) {
            var openRevisions = function() {
                var interpolator = thCloneHtml.get('revisionUrlClone').interpolator;
                var htmlStr = '';
                _.forEach(scope.resultset.revisions, function(revision) {
                    htmlStr = interpolator({repoUrl: scope.currentRepo.url,
                                  revision: revision}) + htmlStr;
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

treeherder.directive('thResultCounts', [
    'thEvents', '$rootScope', function (thEvents, $rootScope) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {

            var setTotalCount = function() {
                if (scope.resultset.job_counts) {
                    $(element).find('.result-status-total-value').html(
                        scope.resultset.job_counts.total - scope.totalExcluded()
                    );
                }
            };

            $rootScope.$on(thEvents.globalFilterChanged, function(evt) {
                setTotalCount();
            });
            $rootScope.$on(thEvents.applyNewJobs, function(evt) {
                setTotalCount();
            });

        },
        templateUrl: 'partials/main/thResultCounts.html'
    };
}]);

treeherder.directive('thResultStatusCount', [
    'thJobFilters', '$rootScope', 'thEvents',
    function (thJobFilters, $rootScope, thEvents) {

    var resultCount = 0;

    var updateResultCount = function(scope, rsCountEl) {
        if(scope.resultset.job_counts) {

            scope.resultCount = (scope.resultset.job_counts[scope.resultStatus] || 0) -
                            thJobFilters.getCountExcluded(scope.resultset.id, scope.resultStatus);
            rsCountEl.find(".rs-count-number").html(scope.resultCount);

            if (scope.resultCount) {
                rsCountEl.removeClass(scope.classifiedClass);
                rsCountEl.addClass(scope.unclassifiedClass);
            } else {
                rsCountEl.addClass(scope.classifiedClass);
                rsCountEl.removeClass(scope.unclassifiedClass);
            }
        }
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.resultStatusCountClassPrefix = scope.getCountClass(scope.resultStatus);
            scope.unclassifiedClass = scope.resultStatusCountClassPrefix + "-count-unclassified";
            scope.classifiedClass = scope.resultStatusCountClassPrefix + "-count-classified";

            var resultCountText = scope.getCountText(scope.resultStatus);
            var resultCountTitleText = "toggle " + scope.resultStatus;

            var rsCountEl = $(element).find(".result-status-count");
            updateResultCount(scope, element);

            rsCountEl.prop('title', resultCountTitleText);
            rsCountEl.find('.rs-count-text').html(resultCountText);

            // so that when you toggle skipping the exclusion profiles,
            // we update the counts to reflect what is seen.
            $rootScope.$on(thEvents.globalFilterChanged, function(evt) {
                updateResultCount(scope, rsCountEl);
            });
            $rootScope.$on(thEvents.applyNewJobs, function(evt) {
                updateResultCount(scope, rsCountEl);
            });
        },
        templateUrl: 'partials/main/thResultStatusCount.html'
    };
}]);

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
        templateUrl: 'partials/main/thRevision.html'
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

