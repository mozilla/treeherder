const userguideApp = angular.module('userguide', []);

userguideApp.config(['$compileProvider', function ($compileProvider) {
    // Disable debug data, as recommended by https://docs.angularjs.org/guide/production
    $compileProvider.debugInfoEnabled(false);
}]).run(['$templateCache', ($templateCache) => {
    // The user guide only requires a single partial - just include it instead
    // of requiring the full set of templates
    $templateCache.put(
        'partials/main/thShortcutTable.html',
        require('../partials/main/thShortcutTable.html')
    );
}]);

export default userguideApp;
