'use strict';

/* jasmine specs for controllers go here */

describe('controllers', function(){
  beforeEach(module('treeherder.controllers'));


  it('should have job_types', inject(function() {
    var $scope = {};
    var pc = $controller('JobsCtrl', { $scope: $scope });
    expect($scope.job_types).size().toEqual(10);  }));

  it('should ....', inject(function() {
    //spec body
  }));
});
