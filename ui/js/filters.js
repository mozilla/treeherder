import numeral from 'numeral';

import treeherder from './treeherder';

treeherder.filter('stripHtml', function () {
    return function (input) {
        const str = input || '';
        return str.replace(/<\/?[^>]+>/gi, '');
    };
});

treeherder.filter('linkifyBugs', function () {
    return function (input) {
        let str = input || '';

        const bug_matches = str.match(/-- ([0-9]+)|bug.([0-9]+)/ig);
        const pr_matches = str.match(/PR#([0-9]+)/ig);

        // Settings
        const bug_title = 'bugzilla.mozilla.org';
        const bug_url = '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$1" ' +
            'data-bugid="$1" title="' + bug_title + '">$1</a>';
        const pr_title = 'github.com';
        const pr_url = '<a href="https://github.com/mozilla-b2g/gaia/pull/$1" ' +
            'data-prid="$1" title="' + pr_title + '">$1</a>';

        if (bug_matches) {
            // Separate passes to preserve prefix
            str = str.replace(/Bug ([0-9]+)/g, "Bug " + bug_url);
            str = str.replace(/bug ([0-9]+)/g, "bug " + bug_url);
            str = str.replace(/-- ([0-9]+)/g, "-- " + bug_url);
        }

        if (pr_matches) {
            // Separate passes to preserve prefix
            str = str.replace(/PR#([0-9]+)/g, "PR#" + pr_url);
            str = str.replace(/pr#([0-9]+)/g, "pr#" + pr_url);
        }

        return str;
    };
});

treeherder.filter('getRevisionUrl', function () {
    return function (revision, projectName) {
        if (revision) {
            return `/#/jobs?repo=${projectName}&revision=${revision}`;
        }
        return '';
    };
});

//http://stackoverflow.com/questions/16630471/how-can-i-invoke-encodeuricomponent-from-angularjs-template
treeherder.filter('encodeURIComponent', function () {
    return window.encodeURIComponent;
});

treeherder.filter('displayNumber', ['$filter', function ($filter) {
    return function (input) {
        if (isNaN(input)) {
            return "N/A";
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
