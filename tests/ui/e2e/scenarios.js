'use strict';

/* http://docs.angularjs.org/guide/dev_guide.e2e-testing */

describe('treeherder', function() {

  beforeEach(function() {
    browser().navigateTo('app/index.html');
  });


  it('should automatically redirect to /jobs when location hash/fragment is empty', function() {
    expect(browser().location().url()).toBe("/jobs");
  });


  describe('view1', function() {

    beforeEach(function() {
      browser().navigateTo('#/jobs');
    });


    it('should render jobs when user navigates to /jobs', function() {
      expect(repeater('.result-set').count()).toBe(10);
    });

  });

});
