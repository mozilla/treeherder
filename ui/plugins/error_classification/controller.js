"use strict";

treeherder.controller('ClassificationPluginCtrl', [
    '$scope', 'ThLog', 'ThFailureLinesModel','$q', 'thTabs', '$timeout',
    function ClassificationPluginCtrl(
        $scope, ThLog, ThFailureLinesModel, $q, thTabs, $timeout) {
        var $log = new ThLog(this.constructor.name);

        $log.debug("error classification plugin initialized");

        var timeoutPromise = null;
        var requestPromise = null;

        thTabs.tabs.errorClassification.update = function() {
            var jobId = thTabs.tabs.errorClassification.contentId;
            // if there's an ongoing timeout, cancel it
            if (timeoutPromise !== null) {
                $timeout.cancel(timeoutPromise);
            }
            // if there's a ongoing request, abort it
            if (requestPromise !== null) {
                requestPromise.resolve();
            }

            requestPromise = $q.defer();

            thTabs.tabs.errorClassification.is_loading = true;
            ThFailureLinesModel.get_list(jobId,
                                         {timeout: requestPromise})
            .then(function(failureLines) {
                $scope.failureLines = failureLines
                $scope.failureLinesLoaded = failureLines.length > 0;
                if (!$scope.failureLinesLoaded) {
                    timeoutPromise = $timeout(thTabs.tabs.errorClassification.update, 5000);
                }
            })
            .finally(function() {
                thTabs.tabs.errorClassification.is_loading = false;
            });
        }
    }
]);
