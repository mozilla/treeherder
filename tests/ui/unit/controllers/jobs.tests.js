/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createResultSetCtrl, jobScope, resultsetScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller
    ) {
        var projectPrefix = '/api/project/mozilla-central/';

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('/api/repository/').respond(
            getJSONFixture('repositories.json')
        );

        $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&format=json&full=true&with_jobs=false').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=28&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=27&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=26&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=25&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=24&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=23&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=22&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=21&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=20&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=19&return_type=list').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET('https://treestatus.mozilla.org/mozilla-central?format=json').respond(
            {
                "status": "closed",
                "message_of_the_day": "See the <a href=\"https://wiki.mozilla.org/Tree_Rules/Inbound\">Inbound tree rules</a> before pushing. <a href=\"https://sheriffs.etherpad.mozilla.org/sheriffing-notes\">Sheriff notes/current issues</a>.",
                "tree": "mozilla-central",
                "reason": "Bustage"
            }
        );

        $httpBackend.whenGET('/api/project/mozilla-central/jobs/0/unclassified_failure_count/').respond(
            {
                "unclassified_failure_count": 1152,
                "repository": "mozilla-central"
            }
        );

        $httpBackend.whenGET('/api/jobtype/').respond(
            getJSONFixture('job_type_list.json')
        );

        $httpBackend.whenGET('/api/jobgroup/').respond(
            getJSONFixture('job_group_list.json')
        );

        jobScope = $rootScope.$new();
        jobScope.setRepoPanelShowing = function(tf) {
            // no op in the tests.
        };

        //setting attributes derived from the parent controller
        jobScope.mru_repos = [];
        $rootScope.new_failures = [];

        $controller('JobsCtrl', {'$scope': jobScope});

        resultsetScope = jobScope.$new();
        createResultSetCtrl = function(resultset) {
            resultsetScope.resultset = resultset;
            return $controller('ResultSetCtrl', {'$scope': resultsetScope});
        };
        $httpBackend.flush();
    }));

    /*
        Tests JobsCtrl
     */

    it('should have 10 resultsets', function() {
        expect(jobScope.result_sets.length).toBe(10);
    });

    /*
        Tests ResultSetCtrl
     */

    it('should have 31 platforms in resultset 8', function() {
        createResultSetCtrl(jobScope.result_sets[8]);
        expect(resultsetScope.resultset.platforms.length).toBe(31);
    });

    it('should set the selectedJob in scope when calling viewJob()', function() {
        createResultSetCtrl(jobScope.result_sets[8]);
        var job = resultsetScope.resultset.platforms[0].groups[0].jobs[0];
        resultsetScope.viewJob(job);
        expect(resultsetScope.selectedJob).toBe(job);
    });

});
