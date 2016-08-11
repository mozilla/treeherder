'use strict';

describe('AutoClassify panel', function() {

    beforeEach(module('treeherder.app'));

    it('thStringOverlap', inject(function(thStringOverlap) {
        expect(thStringOverlap("foo bar", "foo baz")).toEqual(1/2);
        expect(thStringOverlap("a/foo bar", "foo baz")).toEqual(1/2);
        expect(thStringOverlap("", "foo baz")).toEqual(0);
        expect(thStringOverlap("foo bar", "")).toEqual(0);
        expect(thStringOverlap("", "")).toEqual(0);
        expect(thStringOverlap("foo", "foo bar")).toEqual(2/3);
        expect(thStringOverlap("foo|baz", "foo | bar")).toEqual(1/2);
    }));

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
        expect(line.options.map(function(o) { return o.type; })).toEqual(
            ['classified_failure', 'unstructured_bug', 'manual', 'ignore']);
        expect(line.best.isBest).toEqual(true);
        expect(line.status).toEqual('pending');
        expect(line.id).toEqual(5446688);
    }));

    it('ThUnstructuredLine', inject(function(ThUnstructuredLine) {
        var line = new ThUnstructuredLine({
            bug: null,
            bug_number: null,
            bugs: {
                all_others: [{
                    crash_signature: "",
                    id: 809753,
                    keywords: "intermittent-failure",
                    os: "Android",
                    resolution: "FIXED",
                    status: "RESOLVED",
                    summary: "Intermittent reftest shutdown Automation Error: Exception caught while running tests"
                }, {
                    crash_signature: "",
                    id: 895399,
                    keywords: "intermittent-failure",
                    os: "Gonk (Firefox OS)",
                    resolution: "WORKSFORME",
                    status: "RESOLVED",
                    summary: "Intermittent B2G DMError: Attempted to push a file (/tmp/tmpxUzGS1.mozrunner/user.js) to a directory (/data/local/user.js)! | Automation Error: Exception caught while running tests"
                }],
                open_recent: []
            },
            failure_line: null,
            id: 68088710,
            line: "18:19:40     INFO -  Automation Error: Exception caught while running tests",
            line_number: 2113,
            search: "Automation Error: Exception caught while running tests",
            search_terms: ["Automation Error: Exception caught while running tests"],
            summary: 14454946,
            verified: false
        });

        expect(line.type).toEqual('unstructured');
        expect(line.options.map(function(o) { return o.type; })).toEqual(
            ['unstructured_bug', 'unstructured_bug', 'manual', 'ignore']);
    }));
});
