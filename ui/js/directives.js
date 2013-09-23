'use strict';

/* Directives */
treeherder.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

treeherder.directive('thJobButton', function () {

    // determines the right class/color for the button of the job
    var setJobDisplay = function(job) {

        job.display = {btnClass: "disabled"};

        if (job.state === "finished") {
            switch(job.result) {
                case "success":
                    job.display.btnClass = "btn-success";
                    break;
                case "busted":
                case "fail":
                case "testfailed":
                    job.display = {
                        onFire: true,
                        btnClass: "btn-danger"
                    };
                    break;
                case "orange":
                    job.display = {
                        onFire: true,
                        btnClass: "btn-warning"
                    };
                    break;
            }
        }

    };

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        return job.job_type_name + " - " + job.result + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            setJobDisplay(scope.job);
            scope.hoverText = getHoverText(scope.job);
        },
        templateUrl: 'partials/thJob.html'
    };


});
