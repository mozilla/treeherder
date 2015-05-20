/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

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
