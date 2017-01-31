'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, controller, jobsScope;

    beforeEach(module('treeherder.app'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {
        var activeRepo = 'mozilla-central';
        var projectPrefix = '/api/project/' + activeRepo + '/';

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/tests/ui/mock';

        $httpBackend.whenGET('/api/repository/').respond(
            getJSONFixture('repositories.json')
        );

        $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&full=true').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=1&return_type=list').respond(
            getJSONFixture('job_list/job_1.json')
        );

        $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=2&return_type=list').respond(
            getJSONFixture('job_list/job_2.json')
        );

        $httpBackend.whenGET('http://treestatus.mozilla-releng.net/trees/mozilla-central').respond(
            {
                "result": {
                    "status": "closed",
                    "message_of_the_day": "See the <a href=\"https://wiki.mozilla.org/Tree_Rules/Inbound\">Inbound tree rules</a> before pushing. <a href=\"https://sheriffs.etherpad.mozilla.org/sheriffing-notes\">Sheriff notes/current issues</a>.",
                    "tree": "mozilla-central",
                    "reason": "Bustage"
                }
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

        jobsScope = $rootScope.$new();
        jobsScope.repoName = activeRepo;
        jobsScope.setRepoPanelShowing = function(tf) {
                // no op in the tests.
        };
        $controller('JobsCtrl', {'$scope': jobsScope});
    }));

    /*
        Tests JobsCtrl
     */
    it('should have 2 resultsets', function() {
        $httpBackend.flush();
        expect(jobsScope.result_sets).toBeDefined();
        expect(jobsScope.result_sets.length).toBe(2);
    });

    it('should have a job_map', function(){
        $httpBackend.flush();
        expect(jobsScope.job_map).toBeDefined();
    });

    it('should know when it\'s loading the initial data', function() {
        expect(jobsScope.isLoadingRsBatch).toEqual(
            {appending: true, prepending: false }
        );
        $httpBackend.flush();
        expect(jobsScope.isLoadingRsBatch).toEqual(
            {appending: false, prepending: false }
        );
    });

    it('should have 2 platforms in resultset 1', function() {
        // because some http requests are deferred to after first
        // ingestion, we need to flush twice
        $httpBackend.flush();
        $httpBackend.flush();
        expect(jobsScope.result_sets[0].platforms.length).toBe(2);
    });

    /*
        Tests ResultSetCtrl
     */
    describe('ResultSetCtrl', function(){
        var resultSetScopeList;

        beforeEach(inject(function ($rootScope, $controller) {
            /*
            * ResultSetCtrl is created insided a ng-repeat
            * so we should have a list of resultSetscope
            */
            // because some http requests are deferred to after first
            // ingestion, we need to flush twice
            $httpBackend.flush();
            $httpBackend.flush();
            resultSetScopeList = [];
            for(var i=0; i<jobsScope.result_sets.length; i++){
                var resultSetScope = jobsScope.$new();
                resultSetScope.resultset = jobsScope.result_sets[i];
                $controller('ResultSetCtrl', {'$scope': resultSetScope});
                resultSetScopeList.push(resultSetScope);
            }
        }));

        it('should set the selectedJob in scope when calling viewJob()', function() {
            var job = resultSetScopeList[0].resultset.platforms[0].groups[0].jobs[0];
            var resultSetScope = resultSetScopeList[0];
            resultSetScope.viewJob(job);
            expect(resultSetScope.selectedJob).toBe(job);
        });
    });

});
