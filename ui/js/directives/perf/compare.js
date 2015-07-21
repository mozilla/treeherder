/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.directive(
    'phAverage', function() {
        return {
            templateUrl: 'partials/perf/average.html',
            scope: {
                value: '@',
                replicates: '='
            }
        };
    });

treeherder.directive(
    'phConfidence', function() {
        return {
            templateUrl: 'partials/perf/compareconfidence.html',
            scope: {
                result: '='
            }
        };
    });

treeherder.directive(
    'revisionDescribe', function() {
        return {
            restrict: 'E',
            templateUrl: 'partials/perf/revisiondescribe.html',
            scope: {
                project: '=',
                projectRevision: '=',
                author: '=',
                comment: '='
            }
        };
    });
