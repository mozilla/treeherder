"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', 'ThLog', 'ThJobArtifactModel','$q', 'thTabs', '$timeout',
    function BugsPluginCtrl(
        $scope, ThLog, ThJobArtifactModel, $q, thTabs, $timeout) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;

        var bug_limit = 20;
        $scope.tabs = thTabs.tabs;

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
                    name: "Bug suggestions",
                    "type": "json",
                    job_id: newValue
                }, {timeout: requestPromise})
                .then(function(artifact_list){
                    // using a temporary array here to not trigger a
                    // dirty check for every element pushed
                    var suggestions = [];
                    if(artifact_list.length > 0){
                        var artifact = artifact_list[0];
                        angular.forEach(artifact.blob, function (suggestion) {
                            suggestion.bugs.too_many_open_recent = (
                                suggestion.bugs.open_recent.length > bug_limit
                            );
                            suggestion.bugs.too_many_all_others = (
                                suggestion.bugs.all_others.length > bug_limit
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
                        $scope.suggestions = suggestions;
                        $scope.bugSuggestionsLoaded = true;
                    } else if ($scope.selectedJob) {
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
    }
]);
