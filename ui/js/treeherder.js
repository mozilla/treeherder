import angular from 'angular';
import ngResource from 'angular-resource';
import ngSanitize from 'angular-sanitize';

export default angular.module('treeherder', [
  ngResource,
  ngSanitize,
]);
