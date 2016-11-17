'use strict';

treeherder.directive('thLogViewer', ['$sce', '$location', ($sce, $location) => {
    return {
        restrict: "E",
        replace: true,
        link: (scope, elem) => {
            const searchPart = () => {
                const q = $location.search();

                return [
                    'highlightStart',
                    'highlightEnd',
                    'lineNumber',
                    'wrapLines',
                    'showLineNumbers',
                    'jumpToHighlight'
                ].reduce((qs, key) => `${qs}&${key}=${q[key]}`, '');
            };

            elem.on('load', () => {
                const q = $location.search();
                
                scope.logviewerInit();

                if (q.highlightStart !== 'undefined' && q.highlightStart) {
                    scope.logPostMessage({ lineNumber: q.highlightStart });
                }
            });

            scope.$watch('rawLogURL', () => {
                if (scope.rawLogURL) {
                    elem.attr('src', $sce.trustAsResourceUrl(`${scope.logBasePath}?url=${scope.rawLogURL}${searchPart()}`));
                }
            });
        },
        templateUrl: 'partials/logviewer/logviewer.html'
    };
}]);
