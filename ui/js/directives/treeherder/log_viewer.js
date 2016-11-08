'use strict';

treeherder.directive('thLogViewer', ['$sce', '$location', ($sce, $location) => {
    return {
        restrict: "E",
        replace: true,
        link: function (scope, elem) {
            elem.on('load', () => {
                var q = $location.search();

                if (q.highlightStart !== 'undefined' && q.highlightStart) {
                    scope.logPostMessage({ lineNumber: q.highlightStart });
                }
            });

            var searchPart = () => {
                var q = $location.search();

                return [
                  'highlightStart',
                  'highlightEnd',
                  'lineNumber',
                  'wrapLines',
                  'showLineNumbers',
                  'jumpToHighlight'
                ].reduce((qs, key) => `${qs}&${key}=${q[key]}`, '');
            };

            scope.$watch('rawLogURL', () => {
                scope.logviewerURL = $sce.trustAsResourceUrl(`${scope.logBasePath}?url=${scope.rawLogURL}${searchPart()}`);
            });
        },
        templateUrl: 'partials/logviewer/logviewer.html'
    };
}]);
