treeherder.controller('LogviewerCtrl',
    function Logviewer($scope, $http, $timeout) {
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
            return ((h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "")
              + (s > 0 ? s + "s " : "") + (ms > 0 ? ms + "ms " : "00ms"));
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
            $http.get('resources/logs/mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.txt').success(function(data) {
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
            });
        };

        $scope.init = function() {
            $http.get('resources/logs/mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.logview.json').success(function(data) {
                $timeout(function() {
                    $scope.jsonObj = data;
                });
            });
        };
    }
);