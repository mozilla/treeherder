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

treeherder.filter('typeClass', function() {
    // determine whether this is a label for a job group (like mochitest)
    return function(input) {
        if (input.hasOwnProperty("jobs")) {
            return "btn disabled";
        }
    };
});

// todo: does this belong in the controller or here in a filter?
treeherder.filter('warning_level', function() {
    // determine the warning level for the result set of the worst result in
    // the platforms.
    // input: a list of platforms
    return function(input) {
        var LEVELS = {
            1: "green",
            2: "grey",
            3: "orange",
            4: "red"
        };

        var COLORS = {
            "green": 1,
            "grey": 2,
            "orange": 3,
            "red": 4
        };

        var level = 0;
        for (var i = 0; i < input.length; i++) {
            var platform = input[i]
            level = Math.max(level, COLORS[platform.warning_level])
        }
        return LEVELS[level];
    };
});

treeherder.filter('resultClass', function() {
    // Add color to the button for this job
    return function(input) {

        switch(input) {
            case "success":
                return "btn btn-success";
            case "busted":
            case "fail":
                return "btn btn-danger strong";
            case "orange":
                return "btn btn-warning strong";
            case "pending":
                return "btn disabled"
            case "running":
            case "retriggered":
                return "btn";
            default:
                return "btn btn-danger strong";
        }
    };
});