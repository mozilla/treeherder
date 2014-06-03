'use strict';

treeherder.directive('lvInfiniteScroll', ['$timeout', '$parse', function ($timeout, $parse) {
    return function (scope, element, attr) {
        element.bind('scroll', function () {
            var raw = element[0];
            var sh = raw.scrollHeight;
            var onLoadMore = $parse(attr.onLoadMore);

            if (raw.scrollTop <= 100) {
                onLoadMore(scope, {bounds: {top: true}, element: raw}).then(function(haltScrollTop) {
                    if (!haltScrollTop) {
                        $timeout(function() {
                            raw.scrollTop = raw.scrollHeight - sh;
                        });
                    }
                });
            } else if (raw.scrollTop >= (raw.scrollHeight - $(element).height() - 100)) {
                onLoadMore(scope, {bounds: {bottom: true}, element: raw});
            }
        });
    };
}]);