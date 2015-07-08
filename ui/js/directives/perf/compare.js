/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.directive(
  'phRunInfo', function() {
    return {
      templateUrl: 'partials/perf/runinfo.html',
      scope: {
        runs: '='
      }
    }
  });

treeherder.directive(
  'phConfidenceInfo', function() {
    return {
      templateUrl: 'partials/perf/compareconfidence.html',
      scope: {
        text: '@'
      }
    }
  });
