// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names */
import { getJobsUrl } from '../helpers/url';

import treeherder from './treeherder';

treeherder.filter('getRevisionUrl', function () {
    return function (revision, projectName) {
        if (revision) {
            return getJobsUrl({ repo: projectName, revision });
        }
        return '';
    };
});
// TODO replace usage with displayNumber in helpers file
treeherder.filter('displayNumber', ['$filter', function ($filter) {
    return function (input) {
        if (Number.isNaN(input)) {
            return 'N/A';
        }

        return $filter('number')(input, 2);
    };
}]);

treeherder.filter('absoluteValue', function () {
    return function (input) {
        return Math.abs(input);
    };
});
