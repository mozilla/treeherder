"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThTextLogStepModel',
    'ThBugSuggestionsModel', 'thPinboard', 'thEvents', '$q',
    'thTabs', '$timeout', 'thUrl', '$location', 'thReftestStatus',
    function BugsPluginCtrl(
        $scope, $rootScope, ThLog, ThTextLogStepModel, ThBugSuggestionsModel,
        thPinboard, thEvents, $q, thTabs, $timeout, thUrl, $location,
        thReftestStatus) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        $scope.bug_limit = 20;
        $scope.tabs = thTabs.tabs;

        $scope.filerInAddress = false;

        var query;

        // update function triggered by the plugins controller
        thTabs.tabs.failureSummary.update = function () {
            var newValue = thTabs.tabs.failureSummary.contentId;
            $scope.suggestions = [];
            $scope.bugSuggestionsLoaded = false;

            // cancel any existing failure summary queries
            if (query) {
                query.$cancelRequest();
            }

            if (angular.isDefined(newValue)) {
                thTabs.tabs.failureSummary.is_loading = true;

                query = ThBugSuggestionsModel.query({
                    project: $rootScope.repoName,
                    jobId: newValue
                }, function (suggestions) {
                    suggestions.forEach(function (suggestion) {
                        suggestion.bugs.too_many_open_recent = (
                            suggestion.bugs.open_recent.length > $scope.bug_limit
                        );
                        suggestion.bugs.too_many_all_others = (
                            suggestion.bugs.all_others.length > $scope.bug_limit
                        );
                        suggestion.valid_open_recent = (
                            suggestion.bugs.open_recent.length > 0 &&
                                !suggestion.bugs.too_many_open_recent
                        );
                        suggestion.valid_all_others = (
                            suggestion.bugs.all_others.length > 0 &&
                                !suggestion.bugs.too_many_all_others &&
                                // If we have too many open_recent bugs, we're unlikely to have
                                // relevant all_others bugs, so don't show them either.
                                !suggestion.bugs.too_many_open_recent
                        );
                    });

                    // if we have no bug suggestions, populate with the raw errors from
                    // the log (we can do this asynchronously, it should normally be
                    // fast)
                    if (!suggestions.length) {
                        query = ThTextLogStepModel.query({
                            project: $rootScope.repoName,
                            jobId: newValue
                        }, function (textLogSteps) {
                            $scope.errors = textLogSteps
                                .filter(step => step.result !== 'success')
                                .map(function (step) {
                                    return {
                                        name: step.name,
                                        result: step.result,
                                        lvURL: thUrl.getLogViewerUrl(newValue) +
                                            "#L" + step.finished_line_number
                                    };
                                });
                        });
                    }

                    $scope.suggestions = suggestions;
                    $scope.bugSuggestionsLoaded = true;
                    thTabs.tabs.failureSummary.is_loading = false;
                });
            }
        };

        const showBugFilerButton = function () {
            $scope.filerInAddress = $location.search().bugfiler === true;
        };
        showBugFilerButton();
        $rootScope.$on('$locationChangeSuccess', function () {
            showBugFilerButton();
        });

        $scope.bugfilerDialogInit = function (suggestion) {
            return {
                search_terms: suggestion.search_terms,
                fullLog: $scope.job_log_urls[0].url,
                parsedLog: $scope.lvFullUrl,
                reftest: thReftestStatus($scope.selectedJob) ? $scope.reftestUrl : "",
                selectedJob: $scope.selectedJob,
                allFailures: $scope.suggestions.map(sug => sug.search.split(" | "))
            };
        };

        $scope.bugfilerSuccessCallback = function (data) {
            // Auto-classify this failure now that the bug has been filed
            // and we have a bug number
            thPinboard.pinJob($scope.selectedJob);
            thPinboard.addBug({ id: data.success });
            $rootScope.$evalAsync(
                $rootScope.$emit(
                    thEvents.saveClassification));
            // Open the newly filed bug in a new tab or window for further editing
            window.open("https://bugzilla.mozilla.org/show_bug.cgi?id=" + data.success);
        };
    }
]);
