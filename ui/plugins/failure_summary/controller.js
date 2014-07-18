"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThJobArtifactModel', 'ThBugJobMapModel',
    'ThJobClassificationModel', 'thNotify', '$modal', '$q',
    function BugsPluginCtrl(
        $scope, $rootScope, ThLog, ThJobArtifactModel, ThBugJobMapModel,
        ThJobClassificationModel, thNotify, $modal, $q) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        var timeout_promise = null;

        var update_bugs = function(newValue, oldValue) {
            $scope.bugs = [];
            $scope.visible = "open";
            $scope.show_all = false;
            $scope.selected_bugs = {};
            $scope.classification = null;


            // fetch artifacts only if the job is finished
            if (newValue) {
                $scope.tabs.failure_summary.is_loading = true;
                // if there's a ongoing request, abort it
                if (timeout_promise !== null) {
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();
                ThJobArtifactModel.get_list({
                    name__in: "Open bugs,Closed bugs",
                    "type": "json",
                    job_id: newValue
                }, {timeout: timeout_promise})
                .then(function (response) {
                    // iterate to retrieve the total num of failures
                    var searchIdx = {},
                        idx = 0;

                    angular.forEach(response, function (artifact) {
                        var open_closed = artifact.name === "Open bugs" ? "open" : "closed";

                        // the new format is to use an array
                        _.each(artifact.blob, function (failure) {
                            if (!_.has(searchIdx, failure.search)) {
                                $scope.bugs.push({'search': failure.search,
                                                  'open': [],
                                                  'closed': []});
                                searchIdx[failure.search] = idx;
                                idx++;
                            }
                            $scope.bugs[searchIdx[failure.search]][open_closed] = failure.bugs;
                        });
                    });
                })
                .finally(function () {
                    $scope.tabs.failure_summary.is_loading = false;
                });
            }
        };

        $scope.$watch("job.id", update_bugs, true);
    }
]);
