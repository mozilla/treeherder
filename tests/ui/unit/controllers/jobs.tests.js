'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createJobsCtrl, createResultSetCtrl, jobScope, resultsetScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/?count=10&exclude_empty=1&offset=0').respond(
            getJSONFixture('resultset_list.json')
        );

        [1, 2, 3, 6, 7, 9, 11, 13, 14, 17].forEach(function(i) {
            $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/' + i + '/').respond(
                getJSONFixture('resultset_' + i + '.json')
            );
        });

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/jobs/260/').respond(
            getJSONFixture('job_260.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/519/').respond(
            getJSONFixture('artifact_519.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/519').respond(
            getJSONFixture('artifact_519.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note?job_id=260').respond(
            getJSONFixture('notes_job_260.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note/?job_id=260').respond(
            getJSONFixture('notes_job_260.json')
        );

        $httpBackend.whenGET('resources/job_groups.json').respond(
            getJSONFixture('job_groups.json')
        );

        jobScope = $rootScope.$new();
        $controller('JobsCtrl', {'$scope': jobScope});

        resultsetScope = jobScope.$new();
        createResultSetCtrl = function(resultset) {
            resultsetScope.resultset = resultset;
            var ctrl = $controller('ResultSetCtrl', {'$scope': resultsetScope});
            $httpBackend.flush();
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

    it('should have 5 jobs in resultset 2', function() {
        createResultSetCtrl(jobScope.result_sets[2]);
        expect(resultsetScope.job_results.length).toBe(5);
    });

    it('should default to revisions collapsed', function() {
        createResultSetCtrl(jobScope.result_sets[2]);
        expect(resultsetScope.isCollapsedRevisions).toBe(true);
    });

    it('should default to results collapsed for set without failure', function() {
        createResultSetCtrl(jobScope.result_sets[1]);
        expect(resultsetScope.isCollapsedResults).toBe(true);
    });

    it('should default to results not collapsed for set with failure', function() {
        createResultSetCtrl(jobScope.result_sets[2]);
        expect(resultsetScope.isCollapsedResults).toBe(false);
    });

    it('should default to results not collapsed for set with failure', function() {
        createResultSetCtrl(jobScope.result_sets[2]);
        expect(resultsetScope.isCollapsedResults).toBe(false);
    });

    it('should set the selectedJob in scope when calling viewJob()', function() {
        createResultSetCtrl(jobScope.result_sets[2]);
        var job = resultsetScope.job_results[0].groups[0].jobs[0];
        resultsetScope.viewJob(job);
        expect(resultsetScope.selectedJob).toBe(job);
    });

});
