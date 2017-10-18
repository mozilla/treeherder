'use strict';

/*exported treeherder*/
module.exports = angular.module('treeherder',
    ['ngResource', 'ngSanitize', 'ngCookies', 'LocalStorageModule'])
    .constant('pinboardError', 'Max pinboard size of 500 reached.');
