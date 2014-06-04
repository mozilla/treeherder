'use strict';

logViewer.controller('LogviewerCtrl', [
    '$anchorScroll', '$scope', 'ThLog', '$rootScope', '$location', '$http',
    '$timeout', '$q', 'ThJobArtifactModel', 'ThLogSliceModel',
    function Logviewer(
        $anchorScroll, $scope, ThLog, $rootScope, $location, $http,
        $timeout, $q, ThJobArtifactModel, ThLogSliceModel) {

        var $log = new ThLog('LogviewerCtrl');

        // changes the size of chunks pulled from server
        var LINE_BUFFER_SIZE = 100;
        var LogSlice;

        var query_string = $location.search();
        if (query_string.repo !== "") {
            $rootScope.repoName = query_string.repo;
        }
        if (query_string.job_id !== "") {
            $scope.job_id= query_string.job_id;
            LogSlice = new ThLogSliceModel($scope.job_id, LINE_BUFFER_SIZE);
        }

        $scope.displayedLogLines = [];
        $scope.loading = false;
        $scope.currentLineNumber = 0;
        $scope.highestLine = 0;
        $scope.showSuccessful = true;

        $scope.$watch('artifact', function () {
            if (!$scope.artifact) return;
            if ($scope.totalErrors() > 0) {
                $scope.showSuccessful = false;
            } else {
                $scope.showSuccessful = true;
            }
        });

        $scope.totalErrors = function () {
            return $scope.artifact.step_data.steps.reduce(function (prev, curr) {
                if (prev.errors) {
                    return prev.errors.length;
                }

                return prev + curr.errors.length;
            });
        };

        $scope.loadMore = function(bounds, element) {
            var deferred = $q.defer(), range, req, above, below;

            if (!$scope.loading) {
                // move the line number either up or down depending which boundary was hit
                $scope.currentLineNumber = moveLineNumber(bounds);

                range = {
                    start: $scope.currentLineNumber,
                    end: $scope.currentLineNumber
                };

                if (bounds.top) {
                    above = getChunkAbove(range);
                } else if (bounds.bottom) {
                    below = getChunkBelow(range);
                } else {
                    range = getChunksSurrounding($scope.currentLineNumber);
                }

                // dont do the call if we already have all the lines
                if ( range.start === range.end ) return deferred.promise;

                $scope.loading = true;

                LogSlice.get_line_range({
                    job_id: $scope.job_id, 
                    start_line: range.start, 
                    end_line: range.end
                }, {
                    buffer_size: LINE_BUFFER_SIZE
                }).then(function(data) {
                    var slicedData, length;

                    drawErrorLines(data);

                    if (bounds.top) {
                        for (var i = data.length - 1; i >= 0; i--) {
                            // make sure we are inserting at the right place
                            if ($scope.displayedLogLines[0].index != data[i].index + 1) continue;
                            $scope.displayedLogLines.unshift(data[i]);
                        }

                        $timeout(function () {
                            if (above) removeChunkBelow();
                        }, 100);
                    } else if (bounds.bottom) {
                        var sh = element.scrollHeight;
                        var lines = $scope.displayedLogLines;
    
                        for (var i = 0; i < data.length; i++) {
                            // make sure we are inserting at the right place
                            if (lines[ lines.length - 1 ].index != data[i].index - 1) continue;
                            $scope.displayedLogLines.push(data[i]);
                        }

                        $timeout(function () {
                            if (below) {
                                removeChunkAbove();
                                element.scrollTop -= element.scrollHeight - sh;
                            }
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

        $scope.init = function() {
            $log.log(ThJobArtifactModel.get_uri());
            ThJobArtifactModel.get_list({job_id: $scope.job_id, name: 'Structured Log'})
            .then(function(artifact_list){
                if(artifact_list.length > 0){
                    $scope.artifact = artifact_list[0].blob;
                }
            });
        };

        /** utility functions **/

        function logFileLineCount () {
            var steps = $scope.artifact.step_data.steps;
            return steps[ steps.length - 1 ].finished_linenumber;
        }

        function moveLineNumber (bounds) {
            var lines = $scope.displayedLogLines, newLine;

            if (bounds.top) {
                return lines[0].index;
            } else if (bounds.bottom) {
                newLine = lines[lines.length - 1].index + 1;
                return (newLine > logFileLineCount()) ? logFileLineCount(): newLine;
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

        function getChunksSurrounding(line) {
            var request = {start: null, end: null};

            getChunkContaining(line, request);
            getChunkAbove(request);
            getChunkBelow(request);

            return request;
        }

        function getChunkContaining (line, request) {
            var index = Math.floor(line/LINE_BUFFER_SIZE);
            
            request.start = index * LINE_BUFFER_SIZE;
            request.end = (index + 1) * LINE_BUFFER_SIZE;
        }

        function getChunkAbove (request) {
            request.start -= LINE_BUFFER_SIZE;
            request.start = Math.floor(request.start/LINE_BUFFER_SIZE)*LINE_BUFFER_SIZE;

            if (request.start >= 0) {
                return true;
            } else {
                request.start = 0;
                return false;
            }
        }

        function getChunkBelow (request) {
            var lastLine = logFileLineCount();

            request.end += LINE_BUFFER_SIZE;
            request.end = Math.ceil(request.end/LINE_BUFFER_SIZE)*LINE_BUFFER_SIZE;

            if (request.end <= lastLine) {
                return true;
            } else {
                request.end = lastLine;
                return false;
            }
        }

        function removeChunkAbove (request) {
            $scope.displayedLogLines = $scope.displayedLogLines.slice(LINE_BUFFER_SIZE);
        }

        function removeChunkBelow (request) {
            var endSlice = $scope.displayedLogLines.length - LINE_BUFFER_SIZE;
            $scope.displayedLogLines = $scope.displayedLogLines.slice(0, endSlice);
        }

    }
]);
