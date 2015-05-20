/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.directive('lvInfiniteScroll', ['$timeout', '$parse', function ($timeout, $parse) {
    return function (scope, element, attr) {
        element.bind('scroll', function () {
            var raw = element[0];
            var sh = raw.scrollHeight;

            if (raw.scrollTop <= 100) {
                scope.loadMore({top: true}, raw).then(function(haltScrollTop) {
                    if (!haltScrollTop) {
                        $timeout(function() {
                            raw.scrollTop = raw.scrollHeight - sh;
                        });
                    }
                });
            } else if (raw.scrollTop >= (raw.scrollHeight - $(element).height() - 100)) {
                scope.loadMore({bottom: true}, raw);
            }
        });
    };
}]);