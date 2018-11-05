// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable prefer-destructuring */
import treeherder from '../../treeherder';
import logviewerTemplate from '../../../partials/logviewer/logviewer.html';
import { getUrlParam } from '../../../helpers/location';

treeherder.component('thLogViewer', {
    template: logviewerTemplate,
    controller: ['$sce', '$element', '$scope', '$rootScope',
        ($sce, $element, $scope, $rootScope) => {
            const unifiedLogviewerUrl = 'https://taskcluster.github.io/unified-logviewer/';
            const logParams = () => {
                const lineNumber = getUrlParam('lineNumber');
                const params = { lineHeight: 13 };

                if (lineNumber) {
                    const lines = lineNumber.toString().split('-');

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
        }],
});
