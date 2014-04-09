'use strict';

describe('ThResultSetModel', function(){
    var $httpBackend,
        rootScope,
        model;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller, ThResultSetModel) {

        var projectPrefix = 'http://local.treeherder.mozilla.org/api/project/mozilla-inbound/';

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&format=json&full=false').respond(
            getResultSets()
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/1235/').respond(
            getJSONFixture('job_1235.json')
        );

        rootScope = $rootScope.$new();
        rootScope.repoName = "mozilla-inbound";

        model = ThResultSetModel;
        model.load(rootScope.repoName);
        model.addRepository(rootScope.repoName);

        $httpBackend.flush();
    }));

    /*
        Tests ThResultSetModel
     */
    it('should have 1 resultset', function() {
        expect(model.getResultSetsArray().length).toBe(1);
    });
    it('should have 1 resultset', function() {
        expect(model.getResultSetsArray().length).toBe(5);
    });

    /**
     * Test that events for new jobs gets those job updates on the current repo
     */
    it('should add new the current repo', function() {
//        expect(jobScope.result_sets.length).toBe(10);
    });

    /**
     * Test that events for new jobs gets those job updates on a cached repo (not current)
     */

    it('should add new to a cached repo', function() {
//        expect(jobScope.result_sets.length).toBe(10);
    });


    var getResultSets = function() {
        return [
            {
                "repository_id": 4,
                "job_counts": {
                    "exception": 0,
                    "retry": 0,
                    "success": 2,
                    "unknown": 0,
                    "usercancel": 0,
                    "running": 0,
                    "busted": 0,
                    "testfailed": 0,
                    "total": 4,
                    "pending": 0
                },
                "revision_hash": "05c298c5ae3bcc37fd00397511646135bf2416f6",
                "revision_count": 2,
                "author": "Brian Grinstead <test@mozilla.com>",
                "platforms": [
                    {
                        "name": "linux64",
                        "groups": [
                            {
                                "symbol": "?",
                                "jobs": [
                                    {
                                        "machine_name": "bld-centos6-hp-031",
                                        "job_group_symbol": "?",
                                        "job_type_name": "Build",
                                        "job_group_name": "unknown",
                                        "platform_option": "debug",
                                        "reason": "scheduler",
                                        "failure_classification_id": 1,
                                        "job_type_symbol": "B",
                                        "platform": "linux64",
                                        "state": "pending",
                                        "result_set_id": 4939,
                                        "result": "unknown",
                                        "job_coalesced_to_guid": null,
                                        "id": 590604,
                                        "resource_uri": "/api/project/try/jobs/590604/"
                                    },
                                    {
                                        "machine_name": "try-linux64-spot-129",
                                        "job_group_symbol": "?",
                                        "job_type_name": "Static Checking Build",
                                        "job_group_name": "unknown",
                                        "platform_option": "debug",
                                        "reason": "scheduler",
                                        "failure_classification_id": 1,
                                        "job_type_symbol": "S",
                                        "platform": "linux64",
                                        "state": "completed",
                                        "result_set_id": 4939,
                                        "result": "success",
                                        "job_coalesced_to_guid": null,
                                        "id": 590599,
                                        "resource_uri": "/api/project/try/jobs/590599/"
                                    }
                                ],
                                "name": "unknown"
                            }
                        ],
                        "option": "debug"
                    }
                ],
                "revisions_uri": "/api/project/try/resultset/4939/revisions/",
                "push_timestamp": 1396899074,
                "id": 4939,
                "revision": "793611be6b26"
            }
        ];
    };

    var getNewJobs = function() {

        return [
            {
                "submit_timestamp": 1396899126,
                "machine_name": "bld-centos6-hp-031",
                "job_group_symbol": "?",
                "job_group_name": "unknown",
                "platform_option": "debug",
                "job_type_description": "fill me",
                "result_set_id": 4939,
                "result": "success",
                "id": 590604,
                "machine_platform_architecture": "x86_64",
                "end_timestamp": 1396901922,
                "build_platform": "linux64",
                "job_guid": "1cb281fce9b62d27423dfbe31d50a9744f4fc0d6",
                "job_type_name": "Build",
                "platform": "linux64",
                "state": "completed",
                "build_os": "linux",
                "option_collection_hash": "32faaecac742100f7753f0c1d0aa0add01b4046b",
                "who": "bgrinstead@mozilla.com",
                "failure_classification_id": 1,
                "job_type_symbol": "B",
                "reason": "scheduler",
                "job_group_description": "fill me",
                "job_coalesced_to_guid": null,
                "machine_platform_os": "linux",
                "start_timestamp": 1396899181,
                "build_architecture": "x86_64",
                "build_platform_id": 10,
                "machine_id": 346,
                "resource_uri": "/api/project/try/jobs/590604/"
            }
        ];
    };
});
