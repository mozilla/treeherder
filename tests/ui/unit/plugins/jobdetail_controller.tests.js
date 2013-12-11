'use strict';

/* jasmine specs for controllers go here */

describe('JobDetailPluginCtrl', function(){
    var $httpBackend, createJobDetailPluginCtrl, jobDetailPluginScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/?count=10&format=json&offset=0').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/jobs/134/').respond(
            getJSONFixture('job_134.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/jobs/134').respond(
            getJSONFixture('job_134.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/1/').respond(
            getJSONFixture('artifact_1.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/artifact/1').respond(
            getJSONFixture('artifact_1.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note?job_id=134').respond(
            getJSONFixture('notes_job_134.json')
        );

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/note/?job_id=134').respond(
            getJSONFixture('notes_job_134.json')
        );

        $rootScope.repoName = "mozilla-inbound";
        jobDetailPluginScope =  $rootScope.$new();
        createJobDetailPluginCtrl = function() {
            var ctrl = $controller('PluginCtrl', {'$scope': jobDetailPluginScope});
            jobDetailPluginScope.selectedJob = getJSONFixture('resultset_list.json')[2].platforms[0].groups[0].jobs[0];
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
            'Job GUID' : 'e279012c6390dfcb20eecaa50e47a0ab7e809eb0',
            'Machine Platform Arch' : 'x86',
            'Machine Platform OS' : 'b2g',
            'Build Platform' : 'b2g-emu-ics',
            'Build Arch' : 'x86',
            'Build OS' : 'b2g'
        });
    });

//    it('should set jobArtifact when calling viewJob()', function() {
//        createJobDetailPluginCtrl();
//        // toEqual does a deep equality check, but $resource call adds a few
//        // things to the object that don't show on the json stringify output.
//        // so much compare each field separately.
//        expect(jobDetailPluginScope.jobArtifact.name).toEqual("Unknown Builder Job Artifact");
//        expect(jobDetailPluginScope.jobArtifact.active_status).toEqual("active");
//        expect(jobDetailPluginScope.jobArtifact.blob).toEqual({
//            "tinderbox_printlines": [
//                "mozharness_revlink: http://hg.mozilla.org/build/mozharness/rev/dcb709d56ac2",
//                "gaia_revlink: https://git.mozilla.org/?p=releases/gaia.git;a=tree;h=d1bea46121987a35501521ef1d1d5971b137dbdf"
//            ],
//            "logurl": "http://ftp.mozilla.org/pub/mozilla.org/b2g/tinderbox-builds/mozilla-inbound-emulator-debug/1385147851/b2g_mozilla-inbound_emulator-debug_dep-bm84-build1-build15.txt.gz"
//        });
//        expect(jobDetailPluginScope.jobArtifact.type).toEqual("json");
//        expect(jobDetailPluginScope.jobArtifact.id).toEqual(1);
//        expect(jobDetailPluginScope.jobArtifact.job_id).toEqual(134);
//    });

//    it('should set lvArtifact when calling viewJob()', function() {
//        createJobDetailPluginCtrl();
//        expect(jobDetailPluginScope.lvArtifact).toEqual({
//            resource_uri : '/api/project/mozilla-inbound/artifact/2/',
//            type : 'json',
//            id : 2,
//            name : 'Structured Log'
//        });
//    });

});
