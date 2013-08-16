'use strict';

treeherder.controller('LogviewerCtrl',
    function Logviewer($scope, $rootScope, $location, $routeParams, $http, $timeout, thArtifact) {

        if ($location.$$search.hasOwnProperty("repo") &&
            $location.$$search.repo !== "") {
            $rootScope.repo = $location.$$search.repo;
        }
        if ($location.$$search.hasOwnProperty("id") &&
            $location.$$search.id !== "") {
            $scope.lvArtifactId= $location.$$search.id;
        }


        $scope.jsonObj = {};
        $scope.displayedStep;

        // @@@ should this be a directive?
        // @@@ making me re-think my request to not use jquery.  jquery would be better
        // than getElementById.  Though seems like there must be a $scope way to
        // do this?
        $scope.scrollTo = function(step, linenumber) {
            if($scope.displayedStep === step) {
                var pos = document.getElementById("lv-line-"+linenumber).offsetTop -
                             document.getElementById("lv-log-container").offsetTop;
                document.getElementById("lv-log-container").scrollTop = pos;
            }
        };

        // @@@ it may be possible to do this with the angular date filter?
        $scope.formatTime = function(sec) {
            var h = Math.floor(sec/3600);
            var m = Math.floor(sec%3600/60);
            var s = Math.floor(sec%3600 % 60);
            var secStng = sec.toString();
            var ms = secStng.substr(secStng.indexOf(".")+1, 2);
            return ((h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") +
                   (s > 0 ? s + "s " : "") + (ms > 0 ? ms + "ms " : "00ms"));
        };

        $scope.displayTime = function(started, finished) {
            var start = started.substr(started.indexOf(" ")+1, 8);
            var end = finished.substr(finished.indexOf(" ")+1, 8);
            return start + "-" + end;
        };

        $scope.displayLog = function(step) {
            $scope.displayedStep = step;
            var start = step.started_linenumber;
            var end = step.finished_linenumber+1;
            var errors = step.errors;

            // @@@  I think we should only fetch the log once and keep it
            // in the scope.  Then we can slice that to the start/end and
            // display the appropriate part.

            // @@@ we should display some kind of "loading" indicator in the
            // logs area in case the log is really large

            $http.get($scope.logUrl).
                success(function(data) {
                    data = data.split("\n").slice(start, end);

                    $scope.log_text = [];
                    data.forEach(function(item) {
                        $scope.log_text.push({
                            text: item,
                            hasError: false
                        });
                    });
                    if(errors.length > 0) {
                        errors.forEach(function(err) {
                            $scope.log_text[err.linenumber-start].hasError = true;
                            $scope.log_text[err.linenumber-start].errLine = err.linenumber;

                        });
                    }
                }).
                error(function(data, status, headers, config) {
                    console.log("error" + data + status +headers + config);
                });
        };

        $scope.init = function() {
            thArtifact.getArtifact($scope.lvArtifactId).
                success(function(data) {
                    $scope.jsonObj = data.blob;
                    $scope.logUrl = data.blob.logurl;
                    console.log("logUrl: " + $scope.logUrl);
                });

        };

        $scope.insertText = function(data, start, end, errors) {
            var logviewer = document.getElementById("lv_logview");
            logviewer.innerText = '';
            var offset = start;
            var startText = data.splice(0, 1);
            var startDiv = document.createElement("div");
            startDiv.className = "lv-purple-font";
            startDiv.appendChild(document.createTextNode(startText[0]));
            logviewer.appendChild(startDiv);
            var endText = data.splice(-1, 1);
            var endDiv = document.createElement("div");
            endDiv.className = "lv-purple-font";
            endDiv.appendChild(document.createTextNode(endText[0]));

            if(errors.length > 0) {
                errors.forEach(function(err) {
                    var tempData = data.splice(0, err.linenumber-offset-1);
                    var tempText = tempData.join("\n");
                    logviewer.appendChild(document.createTextNode(tempText));
                    var errData = data.splice(0, 1);
                    var errDiv = document.createElement("div");
                    errDiv.className = "label label-important lv-logview-error lv-line-"+err.linenumber;
                    errDiv.appendChild(document.createTextNode(errData[0]));
                    logviewer.appendChild(errDiv);
                    offset = err.linenumber;
                });
                var lastDiv = document.createTextNode(data.join("\n"));
                logviewer.appendChild(lastDiv);
            }
            else {
                logviewer.appendChild(document.createTextNode(data.join("\n")));
            }
            logviewer.appendChild(endDiv);
            document.getElementById("lv_logview_holder").scrollTop = 0;
        }
    }
);