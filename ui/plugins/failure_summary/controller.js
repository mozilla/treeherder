"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThJobArtifactModel','$q', 'thTabs', '$timeout', 'thUrl', '$uibModal', '$location',
    function BugsPluginCtrl(
        $scope, $rootScope, ThLog, ThJobArtifactModel, $q, thTabs, $timeout, thUrl, $uibModal, $location) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;

        $scope.bug_limit = 20;
        $scope.tabs = thTabs.tabs;

        $scope.filerInAddress = false;

        // update function triggered by the plugins controller
        thTabs.tabs.failureSummary.update = function() {
            var newValue = thTabs.tabs.failureSummary.contentId;
            $scope.suggestions = [];
            if(angular.isDefined(newValue)) {
                thTabs.tabs.failureSummary.is_loading = true;
                // if there's an ongoing timeout, cancel it
                if (timeoutPromise !== null) {
                    $timeout.cancel(timeoutPromise);
                }
                // if there's a ongoing request, abort it
                if (requestPromise !== null) {
                    requestPromise.resolve();
                }

                requestPromise = $q.defer();

                ThJobArtifactModel.get_list({
                    name__in: "Bug suggestions,text_log_summary",
                    "type": "json",
                    job_id: newValue
                }, {timeout: requestPromise})
                .then(function(artifact_list){
                    // using a temporary array here to not trigger a
                    // dirty check for every element pushed
                    var suggestions = [];
                    if(artifact_list.length > 0){
                        var artifact = _.find(artifact_list, {"name": "Bug suggestions"});
                        angular.forEach(artifact.blob, function (suggestion) {
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
                            suggestions.push(suggestion);
                        });
                        var errors = [];
                        if (suggestions.length === 0 && artifact_list.length > 1) {
                            artifact = _.find(artifact_list, {"name": "text_log_summary"});
                            angular.forEach(artifact.blob.step_data.steps, function(step) {
                                if (step.result !== "success") {
                                    errors.push({
                                        "name": step.name,
                                        "result": step.result,
                                        "lvURL": thUrl.getLogViewerUrl(artifact.job_id) + "#L" + step.finished_linenumber
                                    });
                                }
                            });
                        }
                        $scope.suggestions = suggestions;
                        $scope.errors = errors;
                        $scope.bugSuggestionsLoaded = true;
                    } else if ($scope.selectedJob && $scope.logParseStatus === "parsed") {
                        $scope.bugSuggestionsLoaded = false;
                        // set a timer to re-run update() after 5 seconds
                        timeoutPromise = $timeout(thTabs.tabs.failureSummary.update, 5000);
                    }
                })
                .finally(function () {
                    thTabs.tabs.failureSummary.is_loading = false;
                });
            }
        };

        var showBugFilerButton = function() {
            $scope.filerInAddress = $location.search().bugfiler === true;
        };
        showBugFilerButton();
        $rootScope.$on('$locationChangeSuccess', function() {
            showBugFilerButton();
        });

        $scope.fileBug = function(index) {
            var summary = $scope.suggestions[index].search;
            var allFailures = [];

            for( var i=0; i<$scope.suggestions.length; i++) {
                allFailures.push($scope.suggestions[i].search.split(" | "));
            }

            var modalInstance = $uibModal.open({
                templateUrl: 'partials/main/intermittent.html',
                controller: 'BugFilerCtrl',
                size: 'lg',
                resolve: {
                    summary: function() {
                        return summary;
                    },
                    fullLog: function() {
                        return $scope.job_log_urls[0].url;
                    },
                    parsedLog: function() {
                        return $scope.lvFullUrl;
                    },
                    reftest: function() {
                        return $scope.isReftest() ? $scope.reftestUrl : "";
                    },
                    selectedJob: function() {
                        return $scope.selectedJob;
                    },
                    allFailures: function() {
                        return allFailures;
                    },
                    fromAutoclassify: function() {
                        return false;
                    }
                }
            });

            modalInstance.opened.then(function () {
                window.setTimeout(function () { modalInstance.initiate(); }, 0);
            });
        };
    }
]);
