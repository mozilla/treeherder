'use strict';

treeherder.directive('thLogViewer', ['$sce', '$location', ($sce, $location) => {
    return {
        restrict: "E",
        replace: true,
        link: (scope, elem) => {
            const logParams = () => {
                const q = $location.search();
                const lines = q.lineNumber.split('-');
                const params = {
                    lineNumber: lines[0],
                    highlightStart: lines[0],
                    highlightEnd: lines.length === 2 ? lines[1] : lines[0]
                };

                return Object.keys(params)
                  .reduce((qs, key) => `${qs}&${key}=${params[key]}`, '');
            };

            elem.on('load', () => scope.logviewerInit());

            scope.$watch('rawLogURL', () => {
                if (scope.rawLogURL) {
                    elem.attr('src', $sce.trustAsResourceUrl(`${scope.logBasePath}?url=${scope.rawLogURL}${logParams()}`));
                }
            });
        },
        templateUrl: 'partials/logviewer/logviewer.html'
    };
}]);
