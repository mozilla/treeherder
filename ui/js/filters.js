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

treeherder.filter('jobHover', function() {
    // duration of job
    return function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        return job.job_type_name + " - " + job.result + " - " + duration + "mins";
    };
});
