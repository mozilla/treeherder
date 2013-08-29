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

treeherder.filter('jobHover', function() {
    // duration of job
    return function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        return job.job_type_name + " - " + job.result + " - " + duration + "mins";
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
            case "retry":
                return "btn";
            default:
                return "btn btn-danger strong";
        }
    };
});