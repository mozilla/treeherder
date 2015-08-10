'use strict';

describe('ThResultSetStore', function(){

    var $httpBackend,
        rootScope,
        model,
        repoModel,
        foregroundRepo = "mozilla-central",
        projectPrefix = '/api/project/',
        foregroundPrefix = projectPrefix + foregroundRepo;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller,
                                ThResultSetStore, ThRepositoryModel) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/tests/ui/mock';



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

        $httpBackend.whenGET(foregroundPrefix + '/resultset/?count=10&full=true').respond(
            getJSONFixture('resultset_list.json')
        );

        
        $httpBackend.whenGET(foregroundPrefix + '/jobs/?count=2000&result_set_id=1&return_type=list').respond(
            getJSONFixture('job_list/job_1.json')
        );

        $httpBackend.whenGET(foregroundPrefix + '/jobs/?count=2000&result_set_id=2&return_type=list').respond(
            getJSONFixture('job_list/job_2.json')
        );

        $httpBackend.whenGET('/api/repository/').respond(
            getJSONFixture('repositories.json')
        );

        $httpBackend.whenGET('/api/jobtype/').respond(
            getJSONFixture('job_type_list.json')
        );

        $httpBackend.whenGET('/api/jobgroup/').respond(
            getJSONFixture('job_group_list.json')
        );



        rootScope = $rootScope.$new();
        rootScope.repoName = foregroundRepo;

        repoModel = ThRepositoryModel;
        repoModel.load(rootScope.repoName);

        model = ThResultSetStore;
        model.addRepository(rootScope.repoName);
        model.fetchResultSets(rootScope.repoName, 10);

        $httpBackend.flush();
    }));

    /*
        Tests ThResultSetStore
     */
    it('should have 2 resultset', function() {
        expect(model.getResultSetsArray(rootScope.repoName).length).toBe(2);
    });

    it('should have id of 1 in foreground (current) repo', function() {
        expect(model.getResultSetsArray(rootScope.repoName)[0].id).toBe(1);
    });
});
