/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

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

