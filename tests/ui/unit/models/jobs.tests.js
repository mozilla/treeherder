'use strict';

require('../../../../ui/js/models/job.js');
describe('ThJobModel', function(){
    var $httpBackend,
        foregroundRepo = "mozilla-central",
        projectPrefix = '/api/project/',
        foregroundPrefix = projectPrefix + foregroundRepo,
        ThJobModel;

    beforeEach(angular.mock.module('treeherder'));

    beforeEach(inject(function ($injector) {
        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/tests/ui/mock';
        ThJobModel = $injector.get('ThJobModel');
        ThJobModel.get_uri = function(){
            return foregroundPrefix+"/jobs/";
        };
    }));

    describe("get_list", function(){
        beforeEach(inject(function () {
            $httpBackend.whenGET(foregroundPrefix + '/jobs/').respond(
                getJSONFixture('job_list/job_1.json')
            );
        }));

        it("should return a promise", function(){
            var result = ThJobModel.get_list(foregroundRepo);
            $httpBackend.flush();
            expect(result.then).toBeDefined();
            $httpBackend.verifyNoOutstandingRequest();
        });

        describe("pagination", function(){
            beforeEach(inject(function () {
                $httpBackend.whenGET(foregroundPrefix + '/jobs/?count=2').respond(
                    getJSONFixture('job_list/pagination/page_1.json')
                );
                $httpBackend.whenGET(foregroundPrefix + '/jobs/?count=2&offset=2').respond(
                    getJSONFixture('job_list/pagination/page_2.json')
                );
            }));

            it("should return a page of results by default", function(){
                ThJobModel.get_list(
                    foregroundRepo,
                    {count: 2}
                ).
                then(function(jobList){
                    expect(jobList.length).toBe(2);
                });
                $httpBackend.flush();
                $httpBackend.verifyNoOutstandingRequest();
            });

            it("should return all the pages when fetch_all==true", function(){
                ThJobModel.get_list(
                    foregroundRepo,
                    {count: 2},
                    {fetch_all: true}
                ).
                then(function(jobList){
                    expect(jobList.length).toBe(3);
                    expect(jobList[2].id).toBe(3);
                });
                $httpBackend.flush();
                $httpBackend.verifyNoOutstandingRequest();
            });
        });
    });
});
