'use strict';

/* http://docs.angularjs.org/guide/dev_guide.e2e-testing */

describe('treeherder', function() {

  beforeEach(function() {
    browser().navigateTo('../../app/index.html');
  });


//  it('should automatically redirect to /jobs when location hash/fragment is empty', function() {
//    expect(browser().location().url()).toBe("/jobs");
//  });


  describe('view1', function() {

    beforeEach(function() {
      browser().navigateTo('#/view1');
    });


//    it('should render jobs when user navigates to /jobs', function() {
//      expect(element('[ng-view] p:first').text()).
//        toMatch(/partial for view 1/);
//    });

  });


  describe('view2', function() {

    beforeEach(function() {
      browser().navigateTo('#/view2');
    });


//    it('should render view2 when user navigates to /view2', function() {
//      expect(element('[ng-view] p:first').text()).
//        toMatch(/partial for view 2/);
//    });

  });
});
