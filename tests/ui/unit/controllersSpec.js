'use strict';

/* jasmine specs for controllers go here */

describe('controllers', function(){
    var $httpBackend, $rootScope, createController;

    beforeEach(module('treeherder'));

    beforeEach(inject(function ($injector) {

        $httpBackend = $injector.get('$httpBackend');
        $httpBackend.whenGET('resources/job_groups.json').respond(
            jasmine.getJSONFixtures('job_groups.json')
        );
        $httpBackend.whenGET('resources/push_sample.json').respond(
            jasmine.getJSONFixtures('push_sample.json')
        );
        $rootScope = $injector.get('$rootScope');
        var $controller = $injector.get('$controller');

        createController = function() {
            return $controller('JobsCtrl', {'$scope': $rootScope});
        };
    }));

    it('should have job_types', function() {
        var ctrl = createController();
        $httpBackend.flush();
        expect($rootScope.job_types.length).toEqual(30);
    });

    it('should ....', inject(function() {
        var ctrl = createController();

        expect("me").toEqual("me");
    }));
});
