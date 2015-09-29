'use strict';

var userguideApp = angular.module('userguide', []);

userguideApp.config(function ($compileProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);
});
