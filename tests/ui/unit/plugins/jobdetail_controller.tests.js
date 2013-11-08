'use strict';

/* jasmine specs for controllers go here */

describe('JobDetailPluginCtrl', function(){
    var $httpBackend, createJobDetailPluginCtrl, jobDetailPluginScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/?count=10&offset=0').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/2/').respond(
            getJSONFixture('resultset_2.json')
        );

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

        $rootScope.repo = "mozilla-inbound";
        jobDetailPluginScope =  $rootScope.$new();
        createJobDetailPluginCtrl = function() {
            var ctrl = $controller('JobDetailPluginCtrl', {'$scope': jobDetailPluginScope});
            jobDetailPluginScope.selectedJob = getJSONFixture('resultset_3.json').platforms[0].groups[0].jobs[0];
            jobDetailPluginScope.$apply();
            $httpBackend.flush();
            return ctrl;
        };
    }));

    /*
        Tests JobDetailCtrl
     */

    it('should set the visibleFields in the job when calling viewJob()', function() {
        createJobDetailPluginCtrl();
        expect(jobDetailPluginScope.visibleFields).toEqual({
            'Result' : 'success',
            'Job GUID' : '19e993f5b0a717185083fb9eacb2d422b36d6bd1',
            'Machine Platform Arch' : 'ARMv7',
            'Machine Platform OS' : 'android',
            'Build Platform' : '2.2',
            'Build Arch' : 'ARMv7',
            'Build OS' : 'android'
        });
    });

    it('should set jobArtifact when calling viewJob()', function() {
        createJobDetailPluginCtrl();
        // toEqual does a deep equality check, but $resource call adds a few
        // things to the object that don't show on the json stringify output.
        // so much compare each field separately.
        expect(jobDetailPluginScope.jobArtifact.name).toEqual("Unknown Builder Job Artifact");
        expect(jobDetailPluginScope.jobArtifact.active_status).toEqual("active");
        expect(jobDetailPluginScope.jobArtifact.blob).toEqual({
                "errors": [ ],
                "tinderbox_printlines": [
                    "mochitest-plain<br/>895/0/128"
                ],
                "logurl": "http://ftp.mozilla.org/pub/mozilla.org/mobile/tinderbox-builds/mozilla-inbound-android-armv6/1377289258/mozilla-inbound_tegra_android-armv6_test-mochitest-5-bm10-tests1-tegra-build1958.txt.gz"
            });
        expect(jobDetailPluginScope.jobArtifact.type).toEqual("json");
        expect(jobDetailPluginScope.jobArtifact.id).toEqual(519);
        expect(jobDetailPluginScope.jobArtifact.job_id).toEqual(260);
    });

    it('should set lvArtifact when calling viewJob()', function() {
        createJobDetailPluginCtrl();
        expect(jobDetailPluginScope.lvArtifact).toEqual({
            resource_uri : '/api/project/mozilla-inbound/artifact/520/',
            type : 'json',
            id : 520,
            name : 'Structured Log'
        });
    });

});
