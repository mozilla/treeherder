'use strict';

treeherder.factory('ThLog', [
    '$log', 'ThLogConfig',
    function($log, ThLogConfig) {
        // a logger that states the object doing the logging

        var ThLog = function(name) {
            this.name = name;
        };

        /**
         * If ``whitelist`` has values, then only show messages from those.
         * If ``whitelist`` is empty, then skip any messages from ``blacklist`` items.
         */
        var whitelist = ThLogConfig.whitelist;
        var blacklist = ThLogConfig.blacklist;

        ThLog.prototype.getClassName = function() {
            return this.name;
        };

        ThLog.prototype.debug = function() {logIt(this, $log.debug, arguments);};
        ThLog.prototype.log = function() {logIt(this, $log.log, arguments);};
        ThLog.prototype.warn = function() {logIt(this, $log.warn, arguments);};
        ThLog.prototype.info = function() {logIt(this, $log.info, arguments);};
        ThLog.prototype.error = function() {logIt(this, $log.error, arguments);};

        var logIt = function(self, func, args) {
            if ((whitelist.length && _.contains(whitelist, self.getClassName())) ||
                (blacklist.length && !_.contains(blacklist, self.getClassName())) ||
                (!whitelist.length && !blacklist.length)) {
                var newArgs = Array.prototype.slice.call(args);
                newArgs.unshift(self.getClassName());
                func.apply(null, newArgs);
            }
        };

        return ThLog;
    }
]);


/**
 * You can use this to configure which debug lines you want to see in your
 * ``local.conf.js`` file.  You can see ONLY ``ResultSetCtrl`` lines by adding
 * a line like:
 *
 *     ThLogConfigProvider.setWhitelist([
 *         'ResultSetCtrl'
 *     ]);
 *
 * Note: even though this is called ThLogConfig, when you configure it, you must
 * refer to it as a ``ThLogConfigProvider`` in ``local.conf.js``.
 */
treeherder.provider('ThLogConfig', function() {
    this.whitelist = [];
    this.blacklist = [];

    this.setBlacklist = function(bl) {
        this.blacklist = bl;
    };
    this.setWhitelist = function(wl) {
        this.whitelist = wl;
    };

    this.$get = function() {
        var self = this;

        return {

            whitelist: self.whitelist,
            blacklist: self.blacklist

        };
    };

});
