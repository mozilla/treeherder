'use strict';

treeherder.directive('infiniteScroll', ['$timeout', '$parse', function ($timeout, $parse) {
    return function (scope, element, attr) {
        element.bind('scroll', function () {
            var raw = element[0];
            var sh = raw.scrollHeight;
            var invoker = $parse(attr.onScroll);

            if (raw.scrollTop <= 100) {
                invoker(scope, {bounds: {top: true}, element: raw}).then(function(haltScrollTop) {
                    if (!haltScrollTop) {
                        $timeout(function() {
                            raw.scrollTop = raw.scrollHeight - sh;
                        });
                    }
                });
            } else if (raw.scrollTop >= (raw.scrollHeight - $(element).height() - 100)) {
                invoker(scope, {bounds: {bottom: true}, element: raw});
            }
        });
    };
}]);