'use strict';

describe('BugFilerCtrl', function() {
    var $httpBackend, $componentController, bugFilerScope;

    beforeEach(angular.mock.module('treeherder.app'));

    beforeEach(inject(function ($injector, $rootScope, _$componentController_) {
        $componentController = _$componentController_;
        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/tests/ui/mock';

        $httpBackend.whenGET('https://hg.mozilla.org/mozilla-central/json-mozbuildinfo?p=browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js').respond({
          "aggregate": {
            "bug_component_counts": [
              [
                [
                  "Firefox",
                  "Search"
                ],
                1
              ]
            ],
            "recommended_bug_component": [
              "Firefox",
              "Search"
            ]
          },
          "files": {
            "browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js": {
              "bug_component": [
                "Firefox",
                "Search"
              ]
            }
          }
        });

        $httpBackend.whenGET('https://bugzilla.mozilla.org/rest/prod_comp_search/firefox%20::%20search?limit=5').respond({
            "products":[
              {
                "product":"Firefox"
              },
              {
                "component":"Search",
                "product":"Firefox"
              },
              {
                "product":"Marketplace"
              },
              {
                "component":"Search",
                "product":"Marketplace"},
              {
                "product":"Firefox for Android"
              },
              {
                "component":"Search Activity",
                "product":"Firefox for Android"
              },
              {
                "product":"Firefox OS"
              },
              {
                "component":"Gaia::Search",
                "product":"Firefox OS"
              },
              {
                "product":"Cloud Services"
              },
              {
                "component":"Operations: Storage",
                "product":"Cloud Services"
              }
            ]
        });

        var modalInstance = {}
        var summary = "PROCESS-CRASH | browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js | application crashed [@ js::GCMarker::eagerlyMarkChildren]";
        var search_terms = ["browser_searchbar_smallpanel_keyboard_navigation.js", "[@ js::GCMarker::eagerlyMarkChildren]"];
        var fullLog = "https://queue.taskcluster.net/v1/task/AGs4CgN_RnCTb943uQn8NQ/runs/0/artifacts/public/logs/live_backing.log";
        var parsedLog = "http://localhost:5000/logviewer.html#?job_id=89017089&repo=mozilla-inbound";
        var reftest = "";
        var selectedJob = {
          build_architecture: "-",
          build_os: "-",
          build_platform: "linux64",
          build_platform_id: 106,
          build_system_type: "taskcluster",
          end_timestamp: 1491433995,
          failure_classification_id: 1,
          id: 89017089,
          job_coalesced_to_guid: null,
          job_group_description: "",
          job_group_id: 257,
          job_group_name: "Mochitests executed by TaskCluster",
          job_group_symbol: "tc-M",
          job_guid: "006b380a-037f-4670-936f-de37b909fc35/0",
          job_type_description: "",
          job_type_id: 33323,
          job_type_name: "test-linux64/debug-mochitest-browser-chrome-10",
          job_type_symbol: "bc10",
          last_modified: "2017-04-05T23:13:19.178440",
          machine_name: "i-0c32950c0d0ce1419",
          machine_platform_architecture: "-",
          machine_platform_os: "-",
          option_collection_hash: "32faaecac742100f7753f0c1d0aa0add01b4046b",
          platform: "linux64",
          platform_option: "debug",
          push_id: 189151,
          reason: "scheduled",
          ref_data_name: "81213da4a447ba8918bdbe81152e5c1aa3d24365",
          result: "testfailed",
          result_set_id: 189151,
          revision: "718fb66559f71d1838b3bc6b187e050d44e3f566",
          running_eta: 2495,
          signature: "81213da4a447ba8918bdbe81152e5c1aa3d24365",
          start_timestamp: 1491432262,
          state: "completed",
          submit_timestamp: 1491430185,
          tier: 1,
          visible: true,
          who: "ryanvm@gmail.com"
        }
        var allFailures = [
          ["ShutdownLeaks", "process() called before end of test suite"],
          ["browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js", "application terminated with exit code 11"],
          ["browser/components/search/test/browser_searchbar_smallpanel_keyboard_navigation.js", "application crashed [@ js::GCMarker::eagerlyMarkChildren]"],
          ["leakcheck", "default process: missing output line for total leaks!"],
          ["# TBPL FAILURE #"]
        ];
        var crashSignatures = ["@ js::GCMarker::eagerlyMarkChildren"];
        var successCallback = "";


        bugFilerScope = $rootScope.$new();
        bugFilerScope.suggestedProducts = [];
        bugFilerScope.summary = summary;
        bugFilerScope.search_terms = search_terms;
        bugFilerScope.fullLog = fullLog;
        bugFilerScope.parsedLog = parsedLog;
        bugFilerScope.reftest = reftest;
        bugFilerScope.selectedJob = selectedJob;
        bugFilerScope.allFailures = allFailures;
        bugFilerScope.crashSignatures = crashSignatures;
        bugFilerScope.successCallback = successCallback;
        $componentController('bugFiler', { $scope: bugFilerScope }, {});
    }));

    /*
        Tests BugFilerCtrl
     */
    it('should parse summaries', function() {
        // Test parsing mochitest-bc failures
        var summary = "browser/components/sessionstore/test/browser_625016.js | observe1: 1 window in data written to disk - Got 0, expected 1";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("browser/components/sessionstore/test/browser_625016.js");
        expect(summary[0][1]).toBe("observe1: 1 window in data written to disk - Got 0, expected 1");
        expect(summary[1]).toBe("browser_625016.js");

        // Test parsing accessibility failures
        summary = "chrome://mochitests/content/a11y/accessible/tests/mochitest/states/test_expandable.xul" +
                  " | uncaught exception - TypeError: this.textbox.popup.oneOffButtons is undefined at " +
                  "searchbar_XBL_Constructor@chrome://browser/content/search/search.xml:95:9";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("accessible/tests/mochitest/states/test_expandable.xul");
        expect(summary[0][1]).toBe("uncaught exception - TypeError: this.textbox.popup.oneOffButtons is undefined at " +
                                   "searchbar_XBL_Constructor@chrome://browser/content/search/search.xml:95:9");
        expect(summary[1]).toBe("test_expandable.xul");

        // Test parsing xpcshell failures
        summary = "xpcshell-child-process.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("dom/indexedDB/test/unit/test_rename_objectStore_errors.js");
        expect(summary[0][1]).toBe("application crashed [@ mozalloc_abort(char const*)]");
        expect(summary[1]).toBe("test_rename_objectStore_errors.js");

        summary = "xpcshell-unpack.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("dom/indexedDB/test/unit/test_rename_objectStore_errors.js");
        expect(summary[0][1]).toBe("application crashed [@ mozalloc_abort(char const*)]");
        expect(summary[1]).toBe("test_rename_objectStore_errors.js");

        summary = "xpcshell.ini:dom/indexedDB/test/unit/test_rename_objectStore_errors.js | application crashed [@ mozalloc_abort(char const*)]";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("dom/indexedDB/test/unit/test_rename_objectStore_errors.js");
        expect(summary[0][1]).toBe("application crashed [@ mozalloc_abort(char const*)]");
        expect(summary[1]).toBe("test_rename_objectStore_errors.js");

        // Test parsing Windows reftests on C drive
        summary = "file:///C:/slave/test/build/tests/reftest/tests/layout/reftests/w3c-css/submitted/variables/variable-supports-12.html | application timed out after 330 seconds with no output";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("layout/reftests/w3c-css/submitted/variables/variable-supports-12.html");
        expect(summary[0][1]).toBe("application timed out after 330 seconds with no output");
        expect(summary[1]).toBe("variable-supports-12.html");

        // Test parsing Linux reftests
        summary = "file:///home/worker/workspace/build/tests/reftest/tests/image/test/reftest/encoders-lossless/size-7x7.png | application timed out after 330 seconds with no output";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("image/test/reftest/encoders-lossless/size-7x7.png");
        expect(summary[0][1]).toBe("application timed out after 330 seconds with no output");
        expect(summary[1]).toBe("size-7x7.png");

        // Test parsing Windows reftests on Z drive
        summary = "file:///Z:/task_1491428153/build/tests/reftest/tests/layout/reftests/font-face/src-list-local-full.html == file:///Z:/task_1491428153/build/tests/reftest/tests/layout/reftests/font-face/src-list-local-full-ref.html | image comparison, max difference: 255, number of differing pixels: 5184";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("layout/reftests/font-face/src-list-local-full.html == layout/reftests/font-face/src-list-local-full-ref.html");
        expect(summary[0][1]).toBe("image comparison, max difference: 255, number of differing pixels: 5184");
        expect(summary[1]).toBe("src-list-local-full.html");

        // Test parsing android reftests
        summary = "http://10.0.2.2:8854/tests/layout/reftests/css-display/display-contents-style-inheritance-1.html == http://10.0.2.2:8854/tests/layout/reftests/css-display/display-contents-style-inheritance-1-ref.html | image comparison, max difference: 255, number of differing pixels: 699";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("layout/reftests/css-display/display-contents-style-inheritance-1.html == layout/reftests/css-display/display-contents-style-inheritance-1-ref.html");
        expect(summary[0][1]).toBe("image comparison, max difference: 255, number of differing pixels: 699");
        expect(summary[1]).toBe("display-contents-style-inheritance-1.html");

        // Test parsing reftest unexpected pass
        summary = "REFTEST TEST-UNEXPECTED-PASS | file:///home/worker/workspace/build/tests/reftest/tests/layout/" +
                  "reftests/backgrounds/vector/empty/wide--cover--width.html == file:///home/worker/workspace/" +
                  "build/tests/reftest/tests/layout/reftests/backgrounds/vector/empty/ref-wide-lime.html | image comparison";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("TEST-UNEXPECTED-PASS");
        expect(summary[0][1]).toBe("layout/reftests/backgrounds/vector/empty/wide--cover--width.html == layout/reftests/backgrounds/vector/empty/ref-wide-lime.html");
        expect(summary[0][2]).toBe("image comparison");
        expect(summary[1]).toBe("wide--cover--width.html");

        // Test finding the filename when the `TEST-FOO` is not omitted
        summary = "TEST-UNEXPECTED-CRASH | /service-workers/service-worker/xhr.https.html | expected OK";
        summary = bugFilerScope.parseSummary(summary);
        expect(summary[0][0]).toBe("TEST-UNEXPECTED-CRASH");
        expect(summary[0][1]).toBe("/service-workers/service-worker/xhr.https.html");
        expect(summary[0][2]).toBe("expected OK");
        expect(summary[1]).toBe("xhr.https.html");
    });

});
