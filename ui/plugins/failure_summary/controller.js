import angular from 'angular';

import treeherder from '../../js/treeherder';
import intermittentTemplate from '../../partials/main/intermittent.html';

treeherder.controller('BugsPluginCtrl', [
    '$scope', '$rootScope', 'ThTextLogStepModel',
    'ThBugSuggestionsModel', 'thPinboard', 'thEvents',
    'thTabs', 'thUrl', '$uibModal', '$location',
    function BugsPluginCtrl(
        $scope, $rootScope, ThTextLogStepModel, ThBugSuggestionsModel,
        thPinboard, thEvents, thTabs, thUrl, $uibModal, $location) {

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

        var showBugFilerButton = function () {
            $scope.filerInAddress = $location.search().bugfiler === true;
        };
        showBugFilerButton();
        $rootScope.$on('$locationChangeSuccess', function () {
            showBugFilerButton();
        });

        $scope.fileBug = function (index) {
            var summary = $scope.suggestions[index].search;
            var allFailures = [];
            var crashSignatures = [];
            var crashRegex = /application crashed \[@ (.+)\]$/g;
            var crash = summary.match(crashRegex);
            if (crash) {
                var signature = crash[0].split("application crashed ")[1];
                crashSignatures.push(signature);
            }

            for (var i=0; i<$scope.suggestions.length; i++) {
                allFailures.push($scope.suggestions[i].search.split(" | "));
            }

            var modalInstance = $uibModal.open({
                template: intermittentTemplate,
                controller: 'BugFilerCtrl',
                size: 'lg',
                openedClass: "filer-open",
                resolve: {
                    summary: function () {
                        return summary;
                    },
                    search_terms: function () {
                        return $scope.suggestions[index].search_terms;
                    },
                    fullLog: function () {
                        return $scope.job_log_urls[0].url;
                    },
                    parsedLog: function () {
                        return $scope.lvFullUrl;
                    },
                    reftest: function () {
                        return $scope.isReftest() ? $scope.reftestUrl : "";
                    },
                    selectedJob: function () {
                        return $scope.selectedJob;
                    },
                    allFailures: function () {
                        return allFailures;
                    },
                    crashSignatures: function () {
                        return crashSignatures;
                    },
                    successCallback: function () {
                        return function (data) {
                            // Auto-classify this failure now that the bug has been filed
                            // and we have a bug number
                            thPinboard.addBug({ id: data.success });
                            $rootScope.$evalAsync(
                                $rootScope.$emit(
                                    thEvents.saveClassification));
                            // Open the newly filed bug in a new tab or window for further editing
                            window.open("https://bugzilla.mozilla.org/show_bug.cgi?id=" + data.success);
                        };
                    }
                }
            });
            thPinboard.pinJob($scope.selectedJob);

            modalInstance.opened.then(function () {
                window.setTimeout(() => modalInstance.initiate(), 0);
            });
        };
    }
]);
