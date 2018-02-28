import ngResource from 'angular-resource';
import ngSanitize from 'angular-sanitize';
import LocalStorageModule from 'angular-local-storage';

export default angular.module('treeherder', [
  ngResource,
  ngSanitize,
  LocalStorageModule,
]);
