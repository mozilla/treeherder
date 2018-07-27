import numeral from 'numeral';

import treeherder from './treeherder';
import { getJobsUrl } from '../helpers/url';

treeherder.filter('getRevisionUrl', function () {
    return function (revision, projectName) {
        if (revision) {
            return getJobsUrl({ repo: projectName, revision: revision });
        }
        return '';
    };
});

treeherder.filter('displayNumber', ['$filter', function ($filter) {
    return function (input) {
        if (isNaN(input)) {
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
