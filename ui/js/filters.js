// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, prefer-arrow-callback */
import numeral from 'numeral';

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

treeherder.filter('abbreviatedNumber', function () {
    return input =>
        ((input.toString().length <= 5) ? input : numeral(input).format('0.0a'));
});
