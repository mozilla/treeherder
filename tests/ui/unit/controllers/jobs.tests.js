'use strict';

/* jasmine specs for controllers go here */

describe('JobsCtrl', function(){
    var $httpBackend, createController, scope;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/test/mock';

        $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/').respond(
            getJSONFixture('test_resultset_list.json')
        );

        [1, 2, 3, 6, 7, 9, 11, 13, 14, 17].forEach(function(i) {
            $httpBackend.whenGET('http://local.treeherder.mozilla.org/api/project/mozilla-inbound/resultset/' + i + '/').respond(
                getJSONFixture('test_resultset_' + i + '.json')
            );
        });

        $httpBackend.whenGET('resources/job_groups.json').respond(
            getJSONFixture('job_groups.json')
        );

        scope = $rootScope.$new();
        $controller('JobsCtrl', {'$scope': scope});

    }));

    /*

        Tests

     */

    it('should have job_types', function() {
        $httpBackend.flush();
        expect(scope.job_types.length).toBe(59);

    });

    it('should have 10 resultsets', function() {
        $httpBackend.flush();
        expect(scope.result_sets.length).toBe(10);
    });

    it('should ....', inject(function() {

        expect("me").toEqual("me");
    }));
});
