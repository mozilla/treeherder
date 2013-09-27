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

        // the default is disabled
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
        } else {
            switch(job.result) {
                case "running":
                    job.display.btnClass="";
                    break;
            }
        }

    };

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        var status = job.result;
        if (job.state != "finished") {
            status = job.state;
        }
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            setJobDisplay(scope.job);
            scope.hoverText = getHoverText(scope.job);
        },
        templateUrl: 'partials/thJobButton.html'
    };


});


// allow an input on a form to request focus when the value it sets in its
// ``focus-me`` directive is true.  You can set ``focus-me="focusInput"`` and
// when ``$scope.focusInput`` changes to true, it will request focus on
// the element with this directive.
treeherder.directive('focusMe', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      scope.$watch(attrs.focusMe, function(value) {
        if(value === true) {
          $timeout(function() {
            element[0].focus();
            scope[attrs.focusMe] = false;
          }, 0);
        }
      });
    }
  };
});

treeherder.directive('thStar', function ($parse, thStarTypes) {
    return {
        scope: {
            starId: "="
        },
        link: function(scope, element, attrs) {
            scope.$watch('starId', function(newVal) {
                if (newVal) {
                    scope.starType = thStarTypes[newVal];
                    scope.badgeColorClass=scope.starType.star;
                    scope.hoverText=scope.starType.name;
                }
            });
        },
        template: '<span class="label {{ badgeColorClass}}" ' +
                        'title="{{ hoverText }}">' +
                        '<i class="icon-star-empty"></i>' +
                        '</span>'
    };
});
