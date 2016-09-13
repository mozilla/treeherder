'use strict';

logViewerApp.controller('LogviewerCtrl', [
    '$anchorScroll', '$http', '$location', '$q', '$rootScope', '$scope',
    '$timeout', '$resource', 'ThTextLogStepModel', 'ThJobDetailModel', 'ThLog',
    'ThLogSliceModel', 'ThJobModel', 'thNotify', 'dateFilter', 'ThResultSetModel',
    'thDateFormat', 'thReftestStatus',
    function Logviewer(
        $anchorScroll, $http, $location, $q, $rootScope, $scope,
        $timeout, $resource, ThTextLogStepModel, ThJobDetailModel, ThLog,
        ThLogSliceModel, ThJobModel, thNotify, dateFilter, ThResultSetModel,
        thDateFormat, thReftestStatus) {

        // changes the size of chunks pulled from server
        var LINE_BUFFER_SIZE = 100;
        var LogSlice;

        $rootScope.urlBasePath = $location.absUrl().split('logviewer')[0];

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
        $scope.logError = false;
        $scope.jobExists = true;
        $scope.currentLineNumber = 0;
        $scope.highestLine = 0;
        $scope.showSuccessful = true;
        $scope.willScroll = false;

        $scope.$watch('steps', function () {
            if (!$scope.steps) {
                return;
            }
            $scope.showSuccessful = !$scope.hasFailedSteps();
        });

        $scope.$watch('[selectedBegin, selectedEnd]', function(newVal) {
            var newHash = (newVal[0] === newVal[1]) ? newVal[0] : newVal[0] + "-L" + newVal[1];
            if (!isNaN(newVal[0])) {
                $location.hash("L" + newHash);
            } else if ($scope.steps) {
                $location.hash("");
            }
        });

        $scope.$on("$locationChangeSuccess", function() {
            var oldLine = parseInt($scope.currentLineNumber);
            getSelectedLines();

            var newLine = parseInt($scope.selectedBegin);
            var range = LINE_BUFFER_SIZE / 2;
            if ((newLine <= (oldLine - range) || newLine >= oldLine + range) && !$scope.willScroll) {
                if ($scope.steps) {
                    moveScrollToLineNumber(newLine);
                }
            }
            $scope.willScroll = false;
        });

        $scope.click = function(line, $event) {
            $scope.willScroll = true;
            if ($event.shiftKey) {
                if (line.index < $scope.selectedBegin) {
                    $scope.selectedEnd = $scope.selectedBegin;
                    $scope.selectedBegin = line.index;
                } else {
                    $scope.selectedEnd = line.index;
                }
            } else {
                $scope.selectedBegin = $scope.selectedEnd = line.index;
            }
        };

        // Erase the value of selectedBegin, used to erase the hash value when
        // the user clicks on the error step button
        $scope.eraseSelected = function() {
            $scope.selectedBegin = 'undefined';
        };

        $scope.setLineNumber = function(number) {
            $scope.selectedBegin = number;
            $scope.selectedEnd = number;
        };

        $scope.hasFailedSteps = function () {
            var steps = $scope.steps;
            if (!steps) {
                return false;
            }

            for (var i = 0; i < steps.length; i++) {
                // We only recently generated step results as part of ingestion,
                // so we have to check the results property is present.
                // TODO: Remove this when the old data has expired, so long as
                // other data submitters also provide a step result.
                if ('result' in steps[i] && steps[i].result !== 'success' &&
                    steps[i].result !== 'skipped') {

                    return true;
                }
            }
            return false;
        };

        // Get the css class for the result, step buttons and other general use
        $scope.getShadingClass = function(result) {
            return "result-status-shading-" + result;
        };

        $scope.loadMore = function(bounds, element) {
            var deferred = $q.defer(), range, above, below;

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
                if (range.start === range.end) {
                    return deferred.promise;
                }

                $scope.loading = true;
                var lineRangeParams = {
                    job_id: $scope.job_id,
                    start_line: range.start,
                    end_line: range.end
                };
                LogSlice.get_line_range(lineRangeParams, {
                    buffer_size: LINE_BUFFER_SIZE
                }).then(function(data) {
                    drawErrorLines(data);

                    if (bounds.top) {
                        for (var i = data.length - 1; i >= 0; i--) {
                            // make sure we are inserting at the right place
                            if ($scope.displayedLogLines[0].index !== data[i].index + 1) {
                                continue;
                            }
                            $scope.displayedLogLines.unshift(data[i]);
                        }

                        $timeout(function () {
                            if (above) {
                                removeChunkBelow();
                            }
                        }, 100);
                    } else if (bounds.bottom) {
                        var sh = element.scrollHeight;
                        var lines = $scope.displayedLogLines;

                        for (var j = 0; j < data.length; j++) {
                            // make sure we are inserting at the right place
                            if (lines[lines.length - 1].index !== data[j].index - 1) {
                                continue;
                            }
                            $scope.displayedLogLines.push(data[j]);
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
                }, function () {
                    $scope.loading = false;
                    $scope.logError = true;
                    thNotify.send("The log no longer exists or has expired", 'warning', true);
                    deferred.reject();
                });
            } else {
                deferred.reject();
            }

            return deferred.promise;
        };

        // @@@ it may be possible to do this with the angular date filter?
        $scope.formatTime = function(startedStr, finishedStr) {
            if (!startedStr || !finishedStr) {
                return "";
            }

            var sec = Math.abs(new Date(startedStr) - new Date(finishedStr)) / 1000.0;
            var h = Math.floor(sec/3600);
            var m = Math.floor(sec%3600/60);
            var s = Math.floor(sec%3600 % 60);
            var secStng = sec.toString();
            var ms = secStng.substr(secStng.indexOf(".")+1, 2);
            return ((h > 0 ? h + "h " : "") + (m > 0 ? m + "m " : "") +
                   (s > 0 ? s + "s " : "") + (ms > 0 ? ms + "ms " : "00ms"));
        };

        $scope.displayTime = function(started, finished) {
            var start = started ? started.substr(started.indexOf(" ")+1, 8) : '?';
            var end = finished ? finished.substr(finished.indexOf(" ")+1, 8) : '?';
            return start + "-" + end;
        };

        $scope.init = function() {

            $scope.logProperties = [];
            ThJobModel.get($scope.repoName, $scope.job_id).then(function(job) {
                // set the title of the browser window/tab
                $scope.logViewerTitle = job.get_title();

                if (job.logs && job.logs.length) {
                    $scope.rawLogURL = job.logs[0].url;
                }
                // set the result value and shading color class
                $scope.result = {label: "Result", value: job.result};
                $scope.resultStatusShading = $scope.getShadingClass(job.result);

                // other properties, in order of appearance
                $scope.logProperties = [
                    {label: "Job", value: $scope.logViewerTitle},
                    {label: "Machine", value: job.machine_name},
                    {label: "Start", value: dateFilter(job.start_timestamp*1000, thDateFormat)},
                    {label: "End", value: dateFilter(job.end_timestamp*1000, thDateFormat)}
                ];

                // Test to expose the reftest button in the logviewer actionbar
                $scope.isReftest = function() {
                    if (job.job_group_name) {
                        return thReftestStatus(job);
                    }
                };

                // get the revision and linkify it
                ThResultSetModel.getResultSet($scope.repoName, job.result_set_id).then(function(data){
                    var revision = data.data.revision;
                    $scope.logProperties.push({label: "Revision", value: revision});
                });

                ThJobDetailModel.getJobDetails(job.job_guid).then(function(jobDetails) {
                    $scope.job_details = jobDetails;
                });
            }, function () {
                $scope.loading = false;
                $scope.jobExists = false;
                thNotify.send("The job does not exist or has expired", 'danger', true);
            });

            // Make the log and job artifacts available
            ThTextLogStepModel.query({
                project: $rootScope.repoName,
                jobId: $scope.job_id
            }, function(textLogSteps) {
                $scope.steps = textLogSteps;

                // add an ordering to each step
                textLogSteps.forEach((step, i) => {step.order = i;});

                // If the log contains no errors load the head otherwise
                // load the first failure step line in the artifact. We
                // also need to test for the 0th element for outlier jobs.
                var allErrors = _.flatten(textLogSteps.map(s => s.errors));
                if (allErrors.length === 0) {
                    angular.element(document).ready(function () {
                        if (isNaN($scope.selectedBegin)) {
                            for (var i = 0; i < $scope.steps.length; i++) {
                                var step = $scope.steps[i];
                                if (step.result !== "success") {
                                    $scope.selectedBegin = step.started_line_number;
                                    $scope.selectedEnd = step.finished_line_number;
                                    break;
                                }
                            }
                        }
                        moveScrollToLineNumber($scope.selectedBegin);
                    });
                } else {
                    $scope.setLineNumber(allErrors[0].line_number);
                    moveScrollToLineNumber($scope.selectedBegin);
                }
            });
        };

        /** utility functions **/

        function moveScrollToLineNumber(linenumber) {
            $scope.currentLineNumber = linenumber;
            $scope.displayedStep = getStepFromLine(linenumber);
            $scope.loadMore({}).then(function () {
                $timeout(function () {
                    var raw = $('.lv-log-container')[0];
                    var line = $('.lv-log-line[line="' + linenumber + '"]');
                    raw.scrollTop += line.offset().top - $('.run-data').outerHeight() -
                    $('.navbar').outerHeight() - 120;
                });
            });
        }

        function getStepFromLine(linenumber) {
            return $scope.steps.find(function(step) {
                return (step.started_linenumber <= linenumber &&
                        step.finished_linenumber >= linenumber);
            });
        }

        function getSelectedLines () {
            var urlHash = $location.hash();
            var regexSelectedlines = /L(\d+)(-L(\d+))?$/;
            if (regexSelectedlines.test(urlHash)) {
                var matchSelectedLines = urlHash.match(regexSelectedlines);
                if (isNaN(matchSelectedLines[3])) {
                    matchSelectedLines[3] = matchSelectedLines[1];
                }
                $scope.selectedBegin = matchSelectedLines[1];
                $scope.selectedEnd = matchSelectedLines[3];
            }
        }

        function logFileLineCount () {
            var steps = $scope.steps;
            return steps[ steps.length - 1 ].finished_line_number + 1;
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
            if (data.length === 0) {
                return;
            }

            var min = data[0].index;
            var max = data[ data.length - 1 ].index;

            $scope.steps.forEach(function(step) {
                step.errors.forEach(function(err) {
                    var line = err.line_number;

                    if (line < min || line > max) {
                        return;
                    }

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
            }

            request.start = 0;
            return false;
        }

        function getChunkBelow (request) {
            var lastLine = logFileLineCount();

            request.end += LINE_BUFFER_SIZE;
            request.end = Math.ceil(request.end/LINE_BUFFER_SIZE)*LINE_BUFFER_SIZE;

            if (request.end <= lastLine) {
                return true;
            }

            request.end = lastLine;
            return false;
        }

        function removeChunkAbove () {
            $scope.displayedLogLines = $scope.displayedLogLines.slice(LINE_BUFFER_SIZE);
        }

        function removeChunkBelow () {
            var endSlice = $scope.displayedLogLines.length - LINE_BUFFER_SIZE;
            $scope.displayedLogLines = $scope.displayedLogLines.slice(0, endSlice);
        }
    }
]);
