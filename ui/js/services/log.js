'use strict';

treeherder.factory('ThLog', function($log) {
    // a logger that states the object doing the logging

    var name = "";
    var ThLog = function(context_name) {
        name = context_name;
    };

    var logIt = function(func, args) {
        var newArgs = Array.prototype.slice.call(args);
        newArgs.unshift(name);
        func.apply(null, newArgs);
    };

    ThLog.prototype.debug = function() {
        logIt($log.debug, arguments);
    };

    ThLog.prototype.warn = function() {
        logIt($log.warn, arguments);
    };

    ThLog.prototype.info = function() {
        logIt($log.info, arguments);
    };

    ThLog.prototype.error = function() {
        logIt($log.error, arguments);
    };

    return ThLog;
});
