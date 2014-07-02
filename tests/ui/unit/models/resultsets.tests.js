'use strict';

describe('ThResultSetModel', function(){

    var $httpBackend,
        rootScope,
        model,
        foregroundRepo = "foreground-repo",
        backgroundRepo = "background-repo",
        projectPrefix = 'https://treeherder.mozilla.org/api/project/',
        foregroundPrefix = projectPrefix + 'foreground-repo',
        backgroundPrefix = projectPrefix + 'background-repo';

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller,
                                ThResultSetModel) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET(foregroundPrefix + '/resultset/?count=10&format=json&full=true&with_jobs=true').respond(
            getResultSet(1)
        );


        $httpBackend.whenGET(backgroundPrefix + '/resultset/?count=10&format=json&full=true&with_jobs=true').respond(
            getResultSet(10)
        );

        rootScope = $rootScope.$new();
        rootScope.repoName = foregroundRepo;

        model = ThResultSetModel;
        model.addRepository(rootScope.repoName);
        model.fetchResultSets(rootScope.repoName, 10);

        model.addRepository(backgroundRepo);
        model.fetchResultSets(backgroundRepo, 10);

        $httpBackend.flush();
    }));

    /*
        Tests ThResultSetModel
     */
    it('should have 1 resultset', function() {
        expect(model.getResultSetsArray(rootScope.repoName).length).toBe(1);
    });

    it('should have id of 1 in foreground (current) repo', function() {
        expect(model.getResultSetsArray(rootScope.repoName)[0].id).toBe(1);
    });

    it('should have id of 10 in background repo', function() {
        expect(model.getResultSetsArray(backgroundRepo)[0].id).toBe(10);
    });

    var newSocketEvent = function(repoName, data) {
        model.processSocketData(repoName, data);
        model.processUpdateQueues(repoName);
        $httpBackend.flush();
    };

    /**
     * Test that events for new resultsets gets those job updates on the foreground repo
     */
    it('should add new rs to the foreground repo', function() {
        var rsValues = {id: 2, push_timestamp: 1396899074+1},
            data = {
                branch: foregroundRepo,
                job_guids: {
                    590604: {
                        result_set_id: 2,
                        result_set_push_timestamp: 1396899074+1
                    }
                }
            };

        $httpBackend.whenGET(foregroundPrefix + '/resultset/?count=1&format=json&full=true&id__in=2&offset=0&with_jobs=true').respond(
            getResultSet(2, rsValues)
        );

        newSocketEvent(foregroundRepo, data);

        var resultsets = model.getResultSetsArray(foregroundRepo);
        expect(model.getResultSetsArray(backgroundRepo).length).toBe(1);
        expect(resultsets.length).toBe(2);
        expect(_.pluck(resultsets, "id")).toEqual([2, 1]);
    });

    /**
     * Test that events for new resultsets gets those job updates on a cached repo (not foreground)
     */
    it('should add new rs to a background repo', function() {
        var rsValues = {id: 12, push_timestamp: 1396899074+1},
            data = {
                branch: backgroundRepo,
                job_guids: {
                    590604: {
                        result_set_id: 12,
                        result_set_push_timestamp: 1396899074+1
                    }
                }
            };

        $httpBackend.whenGET(backgroundPrefix + '/resultset/?count=1&format=json&full=true&id__in=12&offset=0&with_jobs=true').respond(
            getResultSet(12, rsValues)
        );

        newSocketEvent(backgroundRepo, data);

        var resultsets = model.getResultSetsArray(backgroundRepo);
        expect(model.getResultSetsArray(foregroundRepo).length).toBe(1);
        expect(resultsets.length).toBe(2);
        expect(_.pluck(resultsets, "id")).toEqual([12, 10]);
    });

    /**
     * Test that events for new job in existing resultset gets those job updates on the foreground repo
     */
    it('should add new job to the foreground repo', function() {
        var data = {
            branch: foregroundRepo,
            job_guids: {
                123: {
                    result_set_id: 1,
                    result_set_push_timestamp: 1396899074
                }
            }
        };

        $httpBackend.whenGET(foregroundPrefix + '/jobs/?job_guid__in=123').respond(
            getJob(123, {result_set_id: 1})
        );

        newSocketEvent(foregroundRepo, data);

        var jobs = model.getResultSetsArray(foregroundRepo)[0].platforms[0].groups[0].jobs;
        expect(jobs.length).toBe(3);
        expect(_.pluck(jobs, "id")).toEqual([590604, 590599, 123]);
        expect(_.pluck(jobs, "state")).toEqual(["pending", "completed", "completed"]);
    });

    /**
     * Test that events for new job in existing resultset gets those job updates on the foreground repo
     */
    it('should update an existing job in the foreground repo to its new status', function() {
        var data = {
            branch: foregroundRepo,
            job_guids: {
                590604: {
                    result_set_id: 1,
                    result_set_push_timestamp: 1396899074
                }
            }
        };

        $httpBackend.whenGET(foregroundPrefix + '/jobs/?job_guid__in=590604').respond(
            getJob(590604, {result_set_id: 1})
        );

        newSocketEvent(foregroundRepo, data);

        var jobs = model.getResultSetsArray(foregroundRepo)[0].platforms[0].groups[0].jobs;
        expect(jobs.length).toBe(2);
        expect(_.pluck(jobs, "id")).toEqual([590604, 590599]);
        expect(_.pluck(jobs, "state")).toEqual(["completed", "completed"]);
    });

    /**
     * Test that events for new job in existing resultset gets those job updates on the background repo
     */
    it('should add new job to the background repo', function() {
        var data = {
            branch: backgroundRepo,
            job_guids: {
                123: {
                    result_set_id: 10,
                    result_set_push_timestamp: 1396899074
                }
            }
        };

        $httpBackend.whenGET(backgroundPrefix + '/jobs/?job_guid__in=123').respond(
            getJob(123, {result_set_id: 10})
        );

        newSocketEvent(backgroundRepo, data);

        var jobs = model.getResultSetsArray(backgroundRepo)[0].platforms[0].groups[0].jobs;
        expect(jobs.length).toBe(3);
        expect(_.pluck(jobs, "id")).toEqual([590604, 590599, 123]);
        expect(_.pluck(jobs, "state")).toEqual(["pending", "completed", "completed"]);
    });

    /**
     * Test that events for new job in existing resultset gets those job updates on the background repo
     */
    it('should update an existing job in the background repo to its new status', function() {
        var data = {
            branch: backgroundRepo,
            job_guids: {
                590604: {
                    result_set_id: 10,
                    result_set_push_timestamp: 1396899074
                }
            }
        };

        $httpBackend.whenGET(backgroundPrefix + '/jobs/?job_guid__in=590604').respond(
            getJob(590604, {result_set_id: 10})
        );

        newSocketEvent(backgroundRepo, data);

        var jobs = model.getResultSetsArray(backgroundRepo)[0].platforms[0].groups[0].jobs;
        expect(jobs.length).toBe(2);
        expect(_.pluck(jobs, "id")).toEqual([590604, 590599]);
        expect(_.pluck(jobs, "state")).toEqual(["completed", "completed"]);
    });



    /********************************************
     * Data constructors
     */

    /**
     * Return a single length array of one resultset.  Replace fields with
     * those contained in ``values``
     * @param values
     * @returns {*[]}
     */
    var getResultSet = function(id, values) {
        values = values || {};

        var rs =  {
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
                                    "result_set_id": id,
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
                                    "result_set_id": id,
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
            push_timestamp: 1396899074,
            id: id,
            "revision": "793611be6b26"
        };
        _.extend(rs, values);
        return {
            "meta": {
                "count": 1,
                "filter_params": {
                    "count": "10",
                    "full": "false",
                    "format": "json"
                },
                "repository": "mozilla-central"
            },
            "results": [rs]
        };
    };

    var getJob = function(id, values) {
        values = values || {};

        var job = {
            "submit_timestamp": 1396899126,
            "machine_name": "bld-centos6-hp-031",
            "job_group_symbol": "?",
            "job_group_name": "unknown",
            "platform_option": "debug",
            "job_type_description": "fill me",
            "result_set_id": 4939,
            "result": "success",
            "id": id,
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
        };

        _.extend(job, values);
        return [job];

    };
});
