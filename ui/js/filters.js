// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names */
import numeral from 'numeral';

import { getRevisionUrl } from '../helpers/url';

import treeherder from './treeherder';

treeherder.filter('getRevisionUrl', () => getRevisionUrl);

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
