'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createJobsCtrl, createPushCtrl, jobScope, pushScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/').respond(
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

        $httpBackend.whenGET('resources/job_groups.json').respond(
            getJSONFixture('job_groups.json')
        );

        jobScope = $rootScope.$new();
        $controller('JobsCtrl', {'$scope': jobScope});

        pushScope = jobScope.$new();
        createPushCtrl = function(push) {
            pushScope.push = push;
            var ctrl = $controller('PushCtrl', {'$scope': pushScope});
            $httpBackend.flush();
            return  ctrl;
        };
        $httpBackend.flush();
    }));

    /*
        Tests JobsCtrl
     */

    it('should have job_types', function() {
        expect(jobScope.job_types.length).toBe(59);

    });

    it('should have 10 resultsets', function() {
        expect(jobScope.result_sets.length).toBe(10);
    });

    /*
        Tests PushCtrl
     */

    it('should have 5 jobs in resultset 2', function() {
        createPushCtrl(jobScope.result_sets[2]);
        expect(pushScope.job_results.length).toBe(5);
    });

    it('should default to revisions collapsed', function() {
        createPushCtrl(jobScope.result_sets[2]);
        expect(pushScope.isCollapsedRevisions).toBe(true);
    });

    it('should default to results collapsed for set without failure', function() {
        createPushCtrl(jobScope.result_sets[1]);
        expect(pushScope.isCollapsedResults).toBe(true);
    });

    it('should default to results not collapsed for set with failure', function() {
        createPushCtrl(jobScope.result_sets[2]);
        expect(pushScope.isCollapsedResults).toBe(false);
    });

    it('should default to results not collapsed for set with failure', function() {
        createPushCtrl(jobScope.result_sets[2]);
        expect(pushScope.isCollapsedResults).toBe(false);
    });

    it('should set the selectedJob in scope when calling viewJob()', function() {
        var pushCtrl = createPushCtrl(jobScope.result_sets[2]);
        var job = pushScope.job_results[0].groups[0].jobs[0];
        pushScope.viewJob(job);
        expect(pushScope.selectedJob).toBe(job);
    });

});
