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

treeherder.filter('statusClass', function() {
    // Add color to the button for this job
    return function(input) {

        switch(input) {
            case "completed":
                return "btn btn-success";
            case "fail":
                return "btn btn-danger strong";
            case "orange":
                return "btn btn-warning strong";
            case "pending":
                return "btn disabled"
            case "running":
            case "retriggered":
                return "btn";
        }
    };
});