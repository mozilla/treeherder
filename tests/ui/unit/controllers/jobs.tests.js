'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createJobsCtrl, createResultSetCtrl, jobScope, resultsetScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller, thUrl) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/repository/').respond(
            getJSONFixture('repositories.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/?count=10&format=json&full=false').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/jobs/1235/').respond(
            getJSONFixture('job_1235.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/403/').respond(
            getJSONFixture('artifact_403.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/403').respond(
            getJSONFixture('artifact_403.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note?job_id=1235').respond(
            getJSONFixture('notes_job_1235.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note/?job_id=1235').respond(
            getJSONFixture('notes_job_1235.json')
        );

        $httpBackend.whenGET('resources/job_groups.json').respond(
            getJSONFixture('job_groups.json')
        );

        jobScope = $rootScope.$new();

        //setting attributes derived from the parent controller
        jobScope.mru_repos = [];
        $rootScope.new_failures = [];

        $controller('JobsCtrl', {'$scope': jobScope});

        resultsetScope = jobScope.$new();
        createResultSetCtrl = function(resultset) {
            resultsetScope.resultset = resultset;
            var ctrl = $controller('ResultSetCtrl', {'$scope': resultsetScope});
            return  ctrl;
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

    it('should have 139 jobs in resultset 2', function() {
        createResultSetCtrl(jobScope.result_sets[8]);
        expect(resultsetScope.resultset.platforms.length).toBe(14);
    });

    it('should default to revisions collapsed', function() {
        createResultSetCtrl(jobScope.result_sets[8]);
        expect(resultsetScope.isCollapsedRevisions).toBe(true);
    });

    it('should set the selectedJob in scope when calling viewJob()', function() {
        createResultSetCtrl(jobScope.result_sets[8]);
        var job = resultsetScope.resultset.platforms[0].groups[0].jobs[0];
        resultsetScope.viewJob(job);
        expect(resultsetScope.selectedJob).toBe(job);
    });

});
