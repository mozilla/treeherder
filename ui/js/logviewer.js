var myApp = angular.module('app', []);

function Logviewer($scope, $http, $timeout) {
    $scope.jsonObj = {};
    $scope.displayedStep;

    $scope.scrollTo = function(step, linenumber) {
        if($scope.displayedStep === step) {
            var pos = document.getElementsByClassName("lv-line-"+linenumber)[0].offsetTop - 
                         document.getElementById("lv_logview_holder").offsetTop;
            document.getElementById("lv_logview_holder").scrollTop = pos;
        }
    };

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
            data = data.split("\n");
            insertText(data.slice(start, end), start, end, errors);
        });
    };

    $scope.init = function() {
        $http.get('resources/logs/mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122.logview.json').success(function(data) {
            $timeout(function() {
                $scope.jsonObj = data;
            });
        });
    }
}

function insertText(data, start, end, errors) {
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
            errDiv.className = "lv-logview-error lv-line-"+err.linenumber;
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
