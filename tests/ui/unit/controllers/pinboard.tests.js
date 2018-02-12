/* jasmine specs for controllers go here */

describe('PinboardCtrl', function(){
    var $httpBackend, controller, pinboardScope;

    beforeEach(angular.mock.module('treeherder.app'));

    beforeEach(inject(function ($injector, $rootScope, $controller) {
        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath='base/tests/ui/mock';

        pinboardScope = $rootScope.$new();
        $controller('PinboardCtrl', {
          '$scope': pinboardScope,
        });
    }));

    /*
        Tests PinboardCtrl
     */
    it('should determine sha or commit url', function() {
        // Blatantly not a sha or commit
        var str = "banana";
        expect(pinboardScope.isSHAorCommit(str)).toBe(false);
        // This contains a legit 12-char SHA but includes a space
        str = "c00b13480420 8c2652ebd4f45a1d37277c54e60b";
        expect(pinboardScope.isSHAorCommit(str)).toBe(false);
        // This is a valid commit URL
        str = "https://hg.mozilla.org/integration/mozilla-inbound/rev/c00b134804208c2652ebd4f45a1d37277c54e60b";
        expect(pinboardScope.isSHAorCommit(str)).toBe(true);
        // Valid 40-char SHA
        str = "c00b134804208c2652ebd4f45a1d37277c54e60b";
        expect(pinboardScope.isSHAorCommit(str)).toBe(true);
        // Valid 12-char SHA
        str = "c00b13480420";
        expect(pinboardScope.isSHAorCommit(str)).toBe(true);
    });

});
