/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

describe('ThResultSetModel', function(){

    var $httpBackend,
        rootScope,
        model,
        repoModel,
        foregroundRepo = "mozilla-central",
        projectPrefix = 'https://treeherder.mozilla.org/api/project/',
        foregroundPrefix = projectPrefix + foregroundRepo;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller,
                                ThResultSetModel, ThRepositoryModel) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';



        $httpBackend.whenGET('https://treestatus.mozilla.org/mozilla-central?format=json').respond(
            {
                "status": "approval required",
                "message_of_the_day": "I before E",
                "tree": "mozilla-central",
                "reason": ""
            }
        );

        $httpBackend.whenGET(foregroundPrefix + '/jobs/0/unclassified_failure_count/').respond(
            {
                "unclassified_failure_count": 1152,
                "repository": "mozilla-central"
            }
        );

        $httpBackend.whenGET(foregroundPrefix + '/resultset/?count=10&format=json&full=true&with_jobs=false').respond(
            getResultSet(1)
        );

        $httpBackend.whenGET(foregroundPrefix + '/resultset/?count=1&format=json&full=true&id__in=1&offset=0&with_jobs=true').respond(
            getResultSet(1)
        );

        $httpBackend.whenGET(foregroundPrefix + '/resultset/1/get_resultset_jobs/?format=json&result_set_ids=1').respond(
            getResultSet(1)
        );

        $httpBackend.whenGET(foregroundPrefix + '/resultset/1/get_resultset_jobs/?format=json&result_set_ids=10').respond(
            getResultSet(10)
        );

        $httpBackend.whenGET('https://treeherder.mozilla.org/api/repository/').respond(
            getJSONFixture('repositories.json')
        );



        rootScope = $rootScope.$new();
        rootScope.repoName = foregroundRepo;

        repoModel = ThRepositoryModel;
        repoModel.load(rootScope.repoName);

        model = ThResultSetModel;
        model.addRepository(rootScope.repoName);
        model.fetchResultSets(rootScope.repoName, 10);

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
                               [
                                    "bld-centos6-hp-031",
                                    "?",
                                    "Build",
                                    "unknown",
                                    "debug",
                                    "scheduler",
                                    1,
                                    "B",
                                    "linux64",
                                    "pending",
                                    id,
                                    "unknown",
                                    null,
                                    590604,
                                    "/api/project/try/jobs/590604/"
                                ],
                                [
                                    "try-linux64-spot-129",
                                    "?",
                                    "Static Checking Build",
                                    "unknown",
                                    "debug",
                                    "scheduler",
                                    1,
                                    "S",
                                    "linux64",
                                    "completed",
                                    id,
                                    "success",
                                    null,
                                    590599,
                                    "/api/project/try/jobs/590599/"
                                ]
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
            "job_property_names":[
                "machine_name",
                "job_group_symbol",
                "job_type_name",
                "job_group_name",
                "platform_option",
                "reason",
                "failure_classification_id",
                "job_type_symbol",
                "platform",
                "state",
                "result_set_id",
                "result",
                "job_coalesced_to_guid",
                "id",
                "resource_uri"
            ],
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
