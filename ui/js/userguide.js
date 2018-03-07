import angular from 'angular';

import thShortcutTableTemplate from '../partials/main/thShortcutTable.html';

const userguideApp = angular.module('userguide', []);

userguideApp.config(['$compileProvider', function ($compileProvider) {
    // Disable debug data & legacy comment/class directive syntax, as recommended by:
    // https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);
    $compileProvider.commentDirectivesEnabled(false);
    $compileProvider.cssClassDirectivesEnabled(false);
}]).run(['$templateCache', ($templateCache) => {
    // Templates used by ng-include have to be manually put in the template cache.
    // Those used by directives should instead be imported at point of use.
    $templateCache.put('partials/main/thShortcutTable.html', thShortcutTableTemplate);
}]);

export default userguideApp;
