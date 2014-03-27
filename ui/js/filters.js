'use strict';

/* Filters */

treeherder.filter('showOrHide', function() {
    // determine whether this is a label for a job group (like mochitest)
    return function(input, isCollapsed) {
        if (isCollapsed == true) {
            return "show" + input;
        } else {
            return "hide" + input;
        }
    };
});

treeherder.filter('platformName', function() {
    // fix the platform name from the raw name in the db, with the more
    // "human read-able" one from Config.js
    return function(input, name) {
            var newName = Config.OSNames[name];
            if (newName) {
                return newName;
            }
            // if it's not found in Config.js, then return it unchanged.
            return name;
    };
})

treeherder.filter('stripHtml', function() {
    return function(input) {
        var str = input || '';
        return str.replace(/<\/?[^>]+>/gi, '');
    };
})

