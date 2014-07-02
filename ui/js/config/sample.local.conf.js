'use strict';

/* window.thServiceDomain holds a reference to a backend service
 * for result data. This can be one of:
 *
 * -  http://local.treeherder.mozilla.org (local vagrant)
 * -  http://treeherder-dev.allizom.org (dev)
 * -  https://treeherder.allizom.org (stage)
 * -  https://treeherder.mozilla.org (production) */

// By default the service looks to production
window.thServiceDomain = "https://treeherder.mozilla.org";

//treeherder.config(['$logProvider', 'ThLogConfigProvider',
//    function($logProvider, ThLogConfigProvider) {
//
//    // enable or disable debug messages using $log.
//    // comment out the next line to enable them
//    $logProvider.debugEnabled(true);
//
//    // add classes to the blacklist.  all debug messages except
//    // these will print
//    ThLogConfigProvider.setBlacklist([
//        'thRepoDropDown',
//        'RepositoryPanelCtrl',
//        'thWatchedRepo'
//        ...
//    ]);
//
//    // add classes to the whitelist.  Only debug messages with
//    // these classes will print
//    ThLogConfigProvider.setWhitelist([
//        'thRepoDropDown',
//        'RepositoryPanelCtrl',
//        'thWatchedRepo',
//        ...
//    ]);
//}]);
