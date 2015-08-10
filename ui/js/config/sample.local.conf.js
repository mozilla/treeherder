'use strict';

/* window.thServiceDomain holds a reference to a back-end service
 * used to retrieve job result data. Valid settings are  */
var production = "https://treeherder.mozilla.org";
var stage = "https://treeherder.allizom.org";
var vagrant = "";

// Set the service
window.thServiceDomain = production;

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
