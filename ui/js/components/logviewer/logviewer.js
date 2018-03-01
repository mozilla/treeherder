import treeherder from '../../treeherder';
import logviewerTemplate from '../../../partials/logviewer/logviewer.html';

treeherder.component('thLogViewer', {
    template: logviewerTemplate,
    controller: ['$sce', '$location', '$element', '$scope', '$rootScope',
        ($sce, $location, $element, $scope, $rootScope) => {
            const unifiedLogviewerUrl = 'https://taskcluster.github.io/unified-logviewer/';
            const logParams = () => {
                const q = $location.search();
                let params = { lineHeight: 13 };

                if (q.lineNumber) {
                    const lines = q.lineNumber.toString().split('-');

                    params.lineNumber = lines[0] - $rootScope.logOffset;
                    params.highlightStart = lines[0];
                    params.highlightEnd = lines.length === 2 ? lines[1] : lines[0];
                }

                return Object.keys(params)
                  .reduce((qs, key) => `${qs}&${key}=${params[key]}`, '');
            };

            $element.find('iframe').on('load', () => $scope.$parent.logviewerInit());

            $scope.$parent.$watch('rawLogURL', () => {
                const parent = $scope.$parent;

                if ($scope.$parent.rawLogURL) {
                    $element[0].childNodes[0].src = $sce.trustAsResourceUrl(`${unifiedLogviewerUrl}?url=${parent.rawLogURL}${logParams()}`);
                }
            });
        }]
});
