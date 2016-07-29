'use strict';

describe('AutoClassify panel', function() {

    beforeEach(module('treeherder.app'));

    var ThStructuredLine;

    it('ThStructuredLine', inject(function(ThStructuredLine) {
        var line = new ThStructuredLine({
            action: "test_result",
            best_classification: 22294,
            best_is_verified: false,
            classified_failures: [{
                bug: null,
                bug_number: null,
                id: 22294
            }],
            created: "2016-07-29T08:10:33",
            expected: "PASS",
            id: 5446688,
            job_guid: "ad06c0fd77eb6855adf792ae3c46c745413c8983",
            job_log: 40077402,
            level: null,
            line: 436,
            matches: [{
                classified_failure: 22294,
                id: 298034,
                matcher: 1,
                score: "1.00"
            }],
            message: "<very long stack trace>",
            modified: "2016-07-29T08:10:38",
            repository: 2,
            signature: null,
            status: "FAIL",
            subtest: "fake site is gone",
            test: "browser/base/content/test/newtab/browser_newtab_bug722273.js",
            unstructured_bugs: [{
                crash_signature: "",
                id: 1119906,
                keywords: "intermittent-failure",
                os: "Windows 8.1",
                resolution: "",
                status: "NEW",
                summary: "Intermittent browser_newtab_bug722273.js | the fake site is gone"
            }],
        }, [{ id: 1, name: "PreciseTestMatcher"}]);

        expect(line.type).toEqual('structured');
        expect(line.options.length).toEqual(4);
        expect(line.options.map(function(o) { return o.type; })).toEqual(
            ['classified_failure', 'unstructured_bug', 'manual', 'ignore']);
        expect(line.best.isBest).toEqual(true);
        expect(line.status).toEqual('pending');
        expect(line.id).toEqual(5446688);
    }));
});
