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

    it('should ....', inject(function() {

        expect("me").toEqual("me");
    }));

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
        $httpBackend.flush();
        expect(pushScope.selectedJob).toBe(job);
    });

    it('should set the visibleFields in the job when calling viewJob()', function() {
        var pushCtrl = createPushCtrl(jobScope.result_sets[2]);
        var job = pushScope.job_results[0].groups[0].jobs[0];
        pushScope.viewJob(job);
        $httpBackend.flush();
        expect(pushScope.selectedJob.visibleFields).toEqual({
            'Reason' : 'scheduler',
            'State' : 'finished',
            'Result' : 'success',
            'Type Name' : 'mochitest-5',
            'Type Desc' : 'fill me',
            'Who' : 'sendchange-unittest',
            'Job GUID' : '19e993f5b0a717185083fb9eacb2d422b36d6bd1',
            'Machine Name' : 'tegra-363',
            'Machine Platform Arch' : 'ARMv7',
            'Machine Platform OS' : 'android',
            'Build Platform' : '2.2',
            'Build Arch' : 'ARMv7',
            'Build OS' : 'android'
        });
    });

    it('should set jobArtifact when calling viewJob()', function() {
        var pushCtrl = createPushCtrl(jobScope.result_sets[2]);
        var job = pushScope.job_results[0].groups[0].jobs[0];
        pushScope.viewJob(job);
        $httpBackend.flush();
        // toEqual does a deep equality check, but $resource call adds a few
        // things to the object that don't show on the json stringify output.
        // so much compare each field separately.
        expect(pushScope.selectedJob.jobArtifact.name).toEqual("Unknown Builder Job Artifact");
        expect(pushScope.selectedJob.jobArtifact.active_status).toEqual("active");
        expect(pushScope.selectedJob.jobArtifact.blob).toEqual({
                "errors": [ ],
                "tinderbox_printlines": [
                    "mochitest-plain<br/>895/0/128"
                ],
                "logurl": "http://ftp.mozilla.org/pub/mozilla.org/mobile/tinderbox-builds/mozilla-inbound-android-armv6/1377289258/mozilla-inbound_tegra_android-armv6_test-mochitest-5-bm10-tests1-tegra-build1958.txt.gz"
            });
        expect(pushScope.selectedJob.jobArtifact.type).toEqual("json");
        expect(pushScope.selectedJob.jobArtifact.id).toEqual(519);
        expect(pushScope.selectedJob.jobArtifact.job_id).toEqual(260);
    });

    it('should set lvArtifact when calling viewJob()', function() {
        var pushCtrl = createPushCtrl(jobScope.result_sets[2]);
        var job = pushScope.job_results[0].groups[0].jobs[0];
        pushScope.viewJob(job);
        $httpBackend.flush();
        expect(pushScope.selectedJob.lvArtifact).toEqual({
            resource_uri : '/api/project/mozilla-inbound/artifact/520/',
            type : 'json',
            id : 520,
            name : 'Structured Log'
        });
    });

});
