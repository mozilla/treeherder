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

        var update_bugs = function(newValue, oldValue){
            $scope.bugs = {};
            $scope.visible = "open";
            $scope.show_all = false;
            $scope.selected_bugs = {};
            $scope.classification = null;



            // fetch artifacts only if the job is finished
            if(newValue){
                $scope.tabs.bug_suggestions.is_loading = true;
                // if there's a ongoing request, abort it
                if(timeout_promise !== null){
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();
                ThJobArtifactModel.get_list({
                    name__in: "Open bugs,Closed bugs",
                    "type": "json",
                    job_id: newValue
                }, {timeout: timeout_promise})
                .then(function(response){
                    // iterate to retrieve the total num of suggestions
                    angular.forEach(response, function(artifact){
                        var open_closed = artifact.name === "Open bugs" ? "open" : "closed";
                        angular.forEach(artifact.blob, function(suggestions, error){
                            if(!_.has($scope.bugs, error)){
                                var error_prefix_re = /^\d+:\d+:\d+[ ]+(?:DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL) - [ ]?/;
                                error = error.replace(error_prefix_re, '');
                                $scope.bugs[error] = {'open':[], 'closed':[]};
                            }
                            $scope.bugs[error][open_closed] = suggestions;
                        });
                    });
                })
                .finally(function(){
                    $scope.tabs.bug_suggestions.is_loading = false;
                });
            }
        };

        $scope.$watch("job.id", update_bugs, true);
    }
]);
