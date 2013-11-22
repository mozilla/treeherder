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
        job.display = {btnClass: "btn-default"};

        if (job.state == "completed") {
            switch(job.result) {
                case "success":
                    job.display.btnClass = "btn-success";
                    break;
                case "exception":
                case "busted":
                    job.display = {
                        onFire: true,
                        btnClass: "btn-danger"
                    };
                    break;
                case "fail":
                case "testfailed":
                    job.display = {
                        onFire: false,
                        btnClass: "btn-warning"
                    };
                    break;
                case "retry":
                    job.display = {
                        onFire: false,
                        btnClass: "btn-primary"
                    };
                    break;
                case "usercancel":
                    job.display = {
                        onFire: false,
                        btnClass: "btn-pink"
                    };
                    break;
            }
        } else {
            switch(job.state) {
                case "running":
                    job.display.btnClass="btn-ltgray";
                    break;
                case "pending":
                    job.display.btnClass="btn-default";
                    break;
            }
        }

    };

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        var status = job.result;
        if (job.state != "completed") {
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
                        '<i class="glyphicon glyphicon-star-empty"></i>' +
                        '</span>'
    };
});

treeherder.directive('thShowJobs', function ($parse) {
    var SEVERITY = {
        "busted":     {
            button: "btn-danger",
            icon: "glyphicon glyphicon-fire",
        },
        "exception":  {
            button: "btn-danger",
            icon: "glyphicon glyphicon-fire",
        },
        "testfailed": {
            button: "btn-warning",
            icon: "glyphicon glyphicon-warning-sign",
        },
        "retry":      {
            button: "btn-info",
            icon: "glyphicon glyphicon-time",
        },
        "success":    {
            button: "btn-danger",
            icon: "glyphicon glyphicon-ok",
        },
        "usercancel":    {
            button: "btn-danger",
            icon: "glyphicon glyphicon-stop",
        },
        "unknown":    {
            button: "btn-default",
            icon: "glyphicon glyphicon-time",
        }
    };

    return {
        link: function(scope, element, attrs) {
            scope.$watch('resultSeverity', function(newVal) {
                if (newVal) {
                    if (!SEVERITY[newVal]) {
                        newVal = "unknown";
                    }
                    scope.resultsetStateBtn = SEVERITY[newVal].button;
                    scope.icon = SEVERITY[newVal].icon;
                }
            });
        },
        template: '<a class="btn {{ resultsetStateBtn }} th-show-jobs-button pull-left" ' +
                       'ng-click="isCollapsedResults = !isCollapsedResults">' +
                       '<i class="{{ icon }}"></i> ' +
                       '{{ \' jobs\' | showOrHide:isCollapsedResults }}</a>'
    };
});
