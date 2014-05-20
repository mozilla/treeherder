'use strict';

logViewer.controller('LogviewerCtrl', [
    '$anchorScroll', '$scope', 'ThLog', '$rootScope', '$location', '$http',
    '$timeout', '$q', 'ThJobArtifactModel', 'ThLogSliceModel',
    function Logviewer(
        $anchorScroll, $scope, ThLog, $rootScope, $location, $http,
        $timeout, $q, ThJobArtifactModel, ThLogSliceModel) {

        var $log = new ThLog("LogviewerCtrl");

        var query_string = $location.search();
        if (query_string.repo !== "") {
            $rootScope.repoName = query_string.repo;
        }
        if (query_string.job_id !== "") {
            $scope.job_id= query_string.job_id;
        }

        $scope.displayedLogLines = [];
        $scope.loading = false;
        $scope.currentLineNumber = 0;

        var LINE_BUFFER_SIZE = 100;

        $scope.loadMore = function(bounds, element) {
            var deferred = $q.defer();

            if (!$scope.loading) {
                // move the line number either up or down depending which boundary was hit
                $scope.currentLineNumber = moveLineNumber(bounds);

                var range = getLineRangeToDisplay(bounds);

                // dont do the call if we already have all the lines
                if ( range.start === range.end ) return;

                $scope.loading = true;

                ThLogSliceModel.get_line_range({
                    job_id: $scope.job_id, 
                    start_line: range.start, 
                    end_line: range.end
                }).then(function(data) {
                    var slicedData, length;

                    drawErrorLines(data);

                    if (bounds.top) {
                        for (var i = data.length - 1; i >= 0; i--) $scope.displayedLogLines.unshift(data[i]);

                        $timeout(function () {
                            length = $scope.displayedLogLines.length;
                            $scope.displayedLogLines = $scope.displayedLogLines.slice( 0, range.trim );
                        }, 100);
                    } else if (bounds.bottom) {
                        var sh = element.scrollHeight;
    
                        for (var i = 0; i < data.length; i++) $scope.displayedLogLines.push(data[i]);

                        $timeout(function () {
                            length = $scope.displayedLogLines.length;
                            $scope.displayedLogLines = $scope.displayedLogLines.slice( range.trim, length );
                            element.scrollTop -= element.scrollHeight - sh;
                        }, 100);
                    } else {
                        $scope.displayedLogLines = data;
                    }

                    $scope.loading = false;
                    deferred.resolve();
                });
            } else {
                deferred.reject();
            }

            return deferred.promise;
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

        $scope.scrollTo = function($event, step, linenumber) {
            $scope.currentLineNumber = linenumber;

            $scope.loadMore({}).then(function () {
                $timeout(function () {
                    var raw = $('.lv-log-container')[0];
                    raw.scrollTop += $('.lv-log-line[line="' + linenumber + '"]').offset().top - 270; 
                });
            });

            if ( $scope.displayedStep && $scope.displayedStep.order === step.order ) $event.stopPropagation();
        };

        $scope.displayLog = function(step) {
            $scope.displayedStep = step;
            $scope.currentLineNumber = step.started_linenumber;

            $scope.loadMore({}).then(function () {
                $timeout(function () {
                    var raw = $('.lv-log-container')[0];
                    raw.scrollTop += $('.lv-log-line[line="' + step.started_linenumber + '"]').offset().top - 270; 
                });
            });
        };

        $scope.init = function() {
            $log.log(ThJobArtifactModel.get_uri());
            ThJobArtifactModel.get_list({job_id: $scope.job_id, name: "Structured Log"})
            .then(function(artifact_list){
                if(artifact_list.length > 0){
                    $scope.artifact = artifact_list[0].blob;
                    // return $http.get($scope.artifact.logurl)
                    // .success(function(data){
                    //     $scope.sliceLog(data.split("\n"));
                    // });
                }

            });
        };

        function logFileLineCount () {
            var steps = $scope.artifact.step_data.steps;
            return steps[ steps.length - 1 ].finished_linenumber;
        }

        function getRangeUpperBounds () {
            return ($scope.currentLineNumber - LINE_BUFFER_SIZE > 0) 
                   ? $scope.currentLineNumber - LINE_BUFFER_SIZE : 0;
        }

        function getRangeLowerBounds () {
            var lastStepLineNumber = logFileLineCount();

            // make sure that the last line is not past the last line
            return ($scope.currentLineNumber + LINE_BUFFER_SIZE < lastStepLineNumber ) 
                   ? $scope.currentLineNumber + LINE_BUFFER_SIZE : lastStepLineNumber;
        }

        function getLineRangeOfArray (arr) {
            var start, end;

            if (arr.length === 0) {
                start = -1; 
                end = -1;
            } else {
                start = arr[0].index;
                end = arr[arr.length - 1].index;
            }

            return {
                start: start,
                end: end
            };
        }

        function getIndexOfLine ( lineIndex ) {
            for (var i = 0; i < $scope.displayedLogLines.length; i++) {
                if ($scope.displayedLogLines[i].index === lineIndex) return i;
            }

            return -1;
        }

        function getLineRangeToDisplay (bounds) {
            var start, end, overflow, currentRange, trim;

            start = getRangeUpperBounds();
            end = getRangeLowerBounds();
            currentRange = getLineRangeOfArray($scope.displayedLogLines);

            // add any extra lines at the top to the bottom
            overflow = LINE_BUFFER_SIZE - $scope.currentLineNumber; 
            if (overflow > 0) end += overflow;

            // add any extra lines at the bottom to the top
            overflow = LINE_BUFFER_SIZE - (logFileLineCount() - $scope.currentLineNumber);
            if (overflow > 0) start -= overflow;

            if (bounds.top) {
                trim = getIndexOfLine( currentRange.end );
                end = currentRange.start;
            } else if (bounds.bottom) {
                trim = getIndexOfLine( start );
                start = currentRange.end + 1;
            }

            return {
                start: start,
                end: end,
                trim: trim
            };
        }

        function moveLineNumber (bounds) {
            var lines = $scope.displayedLogLines;

            if (bounds.top) {
                return lines[0].index;
            } else if (bounds.bottom) {
                return lines[lines.length - 1].index;
            }

            return $scope.currentLineNumber;
        }

        function drawErrorLines (data) {
            if (data.length === 0) return;

            var min = data[0].index;
            var max = data[ data.length - 1 ].index;

            $scope.artifact.step_data.steps.forEach(function(step) {
                step.errors.forEach(function(err) {
                    var line = err.linenumber;

                    if (line < min || line > max) return;

                    var index = line - min;
                    data[index].hasError = true;
                });
            });
        }

    }
]);
