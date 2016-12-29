'use strict';

treeherder.component('thLogViewer', {
    templateUrl: 'partials/logviewer/logviewer.html',
    controller: ($sce, $location, $element, $scope) => {
        const logParams = () => {
            const q = $location.search();
            let params = { lineHeight: 13 };

            if (q.lineNumber) {
                const lines = q.lineNumber.split('-');

                params.lineNumber = lines[0];
                params.highlightStart = lines[0];
                params.highlightEnd = lines.length === 2 ? lines[1] : lines[0];
            }

            return Object.keys(params)
              .reduce((qs, key) => `${qs}&${key}=${params[key]}`, '');
        };

        $element.find('iframe').bind('load', () => $scope.$parent.logviewerInit());

        $scope.$parent.$watch('rawLogURL', () => {
            const parent = $scope.$parent;

            if ($scope.$parent.rawLogURL) {
                $element[0].childNodes[0].src = $sce.trustAsResourceUrl(`${parent.logBasePath}?url=${parent.rawLogURL}${logParams()}`);
            }
        });
    }
});
