'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createResultSetCtrl, jobScope, resultsetScope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller
    ) {
        var projectPrefix = 'http://local.treeherder.mozilla.org/api/project/mozilla-inbound/';

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/repository/').respond(
            getJSONFixture('repositories.json')
        );

        $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&format=json&full=false&with_jobs=true').respond(
            getJSONFixture('resultset_list.json')
        );

        $httpBackend.whenGET('https://treestatus.mozilla.org/mozilla-inbound?format=json').respond(
            {
                "status": "closed",
                "message_of_the_day": "See the <a href=\"https://wiki.mozilla.org/Tree_Rules/Inbound\">Inbound tree rules</a> before pushing. <a href=\"https://sheriffs.etherpad.mozilla.org/sheriffing-notes\">Sheriff notes/current issues</a>.",
                "tree": "mozilla-inbound",
                "reason": "Bustage"
            }
        );

        jobScope = $rootScope.$new();

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
