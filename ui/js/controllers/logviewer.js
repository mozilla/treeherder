'use strict';

logViewerApp.controller('LogviewerCtrl', [
    '$location', '$window', '$document', '$rootScope', '$scope',
    '$timeout', '$resource', 'ThTextLogStepModel', 'ThJobDetailModel',
    'ThJobModel', 'thNotify', 'dateFilter', 'ThResultSetModel',
    'thDateFormat', 'thReftestStatus',
    function Logviewer(
        $location, $window, $document, $rootScope, $scope,
        $timeout, $resource, ThTextLogStepModel, ThJobDetailModel,
        ThJobModel, thNotify, dateFilter, ThResultSetModel,
        thDateFormat, thReftestStatus) {

        const query_string = $location.search();
        $scope.css = '';
        $rootScope.urlBasePath = $location.absUrl().split('logviewer')[0];
        $rootScope.logOffset = 7;

        if (query_string.repo !== "") {
            $rootScope.repoName = query_string.repo;
        }

        if (query_string.job_id !== "") {
            $scope.job_id= query_string.job_id;
        }

        $scope.loading = false;
        $scope.jobExists = true;
        $scope.showSuccessful = true;

        $scope.$watch('steps', () => {
            if (!$scope.steps) {
                return;
            }

            $scope.showSuccessful = !$scope.hasFailedSteps();
        });

        $scope.logPostMessage = (values) => {
            const { lineNumber, highlightStart } = values;

            if (lineNumber && !highlightStart) {
                values.highlightStart = lineNumber;
                values.highlightEnd = lineNumber;
            }

            updateQuery(values);

            // Add offset to lineNumber to see above the failure line
            if (lineNumber) {
                values.lineNumber -= $rootScope.logOffset;
            }

            $document[0].getElementById('logview').contentWindow.postMessage(values, "*");
        };

        $scope.hasFailedSteps = () => {
            const steps = $scope.steps;

            if (!steps) {
                return false;
            }

            for (let i = 0; i < steps.length; i++) {
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
        $scope.getShadingClass = (result) => {
            return "result-status-shading-" + result;
        };

        // @@@ it may be possible to do this with the angular date filter?
        $scope.formatTime = (startedStr, finishedStr) => {
            if (!startedStr || !finishedStr) {
                return '';
            }

            const sec = Math.abs(new Date(startedStr) - new Date(finishedStr)) / 1000.0;
            const h = Math.floor(sec / 3600);
            const m = Math.floor(sec % 3600 / 60);
            const s = Math.floor(sec % 3600 % 60);
            const secStng = sec.toString();
            const ms = secStng.substr(secStng.indexOf(".") + 1, 2);

            return ((h > 0 ? h + 'h ' : '') + (m > 0 ? m + 'm ' : '') +
                   (s > 0 ? s + 's ' : '') + (ms > 0 ? ms + 'ms ' : '00ms'));
        };

        $scope.displayTime = (started, finished) => {
            const start = started ? started.substr(started.indexOf(' ') + 1, 8) : '?';
            const end = finished ? finished.substr(finished.indexOf(' ') + 1, 8) : '?';

            return start + '-' + end;
        };

        $scope.init = () => {
            $scope.logProperties = [];

            ThJobModel.get_list($scope.repoName, {
                project_specific_id: $scope.job_id
            }).then(function(jobList) {
                if (jobList.length > 0) {
                    $scope.job_id = jobList[0]['id'];
                }
                ThJobModel.get($scope.repoName, $scope.job_id).then(job => {
                    // set the title of the browser window/tab
                    $scope.logViewerTitle = job.get_title();

                    if (job.logs && job.logs.length) {
                        $scope.rawLogURL = job.logs[0].url;
                    }

                    // set the result value and shading color class
                    $scope.result = {label: 'Result', value: job.result};
                    $scope.resultStatusShading = $scope.getShadingClass(job.result);

                    // other properties, in order of appearance
                    $scope.logProperties = [
                        {label: 'Job', value: $scope.logViewerTitle},
                        {label: 'Machine', value: job.machine_name},
                        {label: 'Start', value: dateFilter(job.start_timestamp * 1000, thDateFormat)},
                        {label: 'End', value: dateFilter(job.end_timestamp * 1000, thDateFormat)}
                    ];

                    // Test to expose the reftest button in the logviewer actionbar
                    $scope.isReftest = () => {
                        if (job.job_group_name) {
                            return thReftestStatus(job);
                        }
                    };

                    // get the revision and linkify it
                    ThResultSetModel.getResultSet($scope.repoName, job.result_set_id).then(data => {
                        const revision = data.data.revision;

                        $scope.logProperties.push({label: 'Revision', value: revision});
                    });

                    ThJobDetailModel.getJobDetails({job_guid: job.job_guid}).then(jobDetails => {
                        $scope.job_details = jobDetails;
                    });
                }, () => {
                    $scope.loading = false;
                    $scope.jobExists = false;
                    thNotify.send('The job does not exist or has expired', 'danger', true);
                });
            });
        };

        $scope.logviewerInit = () => {
            // Listen for messages from child frame
            setLogListener();

            ThTextLogStepModel.query({
                project: $rootScope.repoName,
                jobId: $scope.job_id
            }, textLogSteps => {
                let shouldPost = true;
                const allErrors = _.flatten(textLogSteps.map(s => s.errors));
                const q = $location.search();
                $scope.steps = textLogSteps;

                // add an ordering to each step
                textLogSteps.forEach((step, i) => {step.order = i;});

                // load the first failure step line else load the head
                if (allErrors.length) {
                    $scope.css = $scope.css + errorLinesCss(allErrors);

                    if (!q.lineNumber) {
                        $scope.logPostMessage({ lineNumber: allErrors[0].line_number + 1, customStyle: $scope.css });
                        shouldPost = false;
                    }
                } else if (!q.lineNumber) {
                    for (let i = 0; i < $scope.steps.length; i++) {
                        let step = $scope.steps[i];

                        if (step.result !== "success") {
                            $scope.logPostMessage({
                                lineNumber: step.started_line_number + 1,
                                highlightStart: step.started_line_number + 1,
                                highlightEnd: step.finished_line_number + 1,
                                customStyle: $scope.css
                            });

                            break;
                        }
                    }
                }

                if (shouldPost) {
                    $scope.logPostMessage({ customStyle: $scope.css });
                }
            });
        };

        $scope.setDisplayedStep = (step) => {
            const highlightStart = step.started_line_number + 1 || step.line_number + 1;
            const highlightEnd = step.finished_line_number + 1 || step.line_number + 1;
            $scope.displayedStep = step;

            $scope.logPostMessage({ lineNumber: highlightStart, highlightStart, highlightEnd });
        };

        function errorLinesCss(errors) {
            return errors
              .map(({ line_number }) => `a[id="${line_number + 1}"]+span`)
              .join(',')
              .concat('{background:#fbe3e3;color:#a94442}');
        }

        function logCss() {
            const hideToolbar = '#toolbar{display:none}';
            const body = 'html,body{background:#f8f8f8;color:#333;font-size:12px}';
            const highlight = '#log .highlight a,#log .highlight span{background:#f8eec7!important}';
            const hover = '#log .line:hover{background:transparent}#log .line a:hover,#log .highlight a:hover{background:#f8eec7;color:#000}';
            const stripe = '.lazy-list .line:nth-child(2n){background:#fff!important}.lazy-list .line:nth-child(2n+1){background:#f8f8f8!important}';
            const linePadding = '#log .line{padding:0 15px 0 35px}';
            const lineNumber = '#log .line a,#log .highlight a{color:rgba(0,0,0,.3)}';
            const font = '#log{font-family:monospace}';

            return hideToolbar + body + highlight + hover + stripe + lineNumber + linePadding + font;
        }

        /** utility functions **/

        function updateQuery(values) {
            const data = typeof values === 'string' ? JSON.parse(values) : values;
            const { lineNumber, highlightStart, highlightEnd } = data;

            if (highlightStart !== highlightEnd) {
                $location.search('lineNumber', `${highlightStart}-${highlightEnd}`).replace();
            }
            else if (highlightStart) {
                $location.search('lineNumber', highlightStart).replace();
            } else {
                $location.search('lineNumber', lineNumber).replace();
            }
        }

        function setLogListener() {
            let workerReady = false;

            $window.addEventListener('message', (e) => {
                // Send initial css when child frame loads URL successfully
                if (!workerReady) {
                    workerReady = true;

                    $scope.css = $scope.css + logCss();
                    $scope.logPostMessage({ customStyle: $scope.css });
                }

                $timeout(updateQuery(e.data));
            });
        }
    }
]);
