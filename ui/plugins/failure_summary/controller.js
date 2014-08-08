"use strict";

treeherder.controller('BugsPluginCtrl', [
    '$scope', 'ThLog', 'ThJobArtifactModel','$q',
    function BugsPluginCtrl(
        $scope, ThLog, ThJobArtifactModel, $q) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("bugs plugin initialized");

        var timeout_promise = null;
        var failure_results = ["busted", "exception", "testfailed"];
        var bug_limit = 20;

        var update_bugs = function(newValue, oldValue) {
            $scope.suggestions = [];
            // retrieve bug suggestions only if the job has failures
            if(angular.isDefined(newValue) &&
                    failure_results.indexOf($scope.job.result) !== -1){
                $scope.tabs.failure_summary.is_loading = true;
                // if there's a ongoing request, abort it
                if (timeout_promise !== null) {
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();

                ThJobArtifactModel.get_list({
                    name: "Bug suggestions",
                    "type": "json",
                    job_id: newValue
                }, {timeout: timeout_promise})
                .then(function(artifact_list){
                    // using a temporary array here to not trigger a
                    // dirty check for every element pushed
                    var suggestions = [];
                    if(artifact_list.length > 0){
                        var artifact = artifact_list[0];
                        angular.forEach(artifact.blob, function (suggestion) {

                            if(suggestion.bugs.open_recent.length > bug_limit){
                                suggestion.bugs.too_many_open_recent = true;
                            }else{
                                suggestion.bugs.too_many_open_recent  = false;
                            }

                            if(suggestion.bugs.all_others.length > bug_limit){
                                suggestion.bugs.too_many_all_others = true;
                            }else{
                                suggestion.bugs.too_many_all_others = false;
                            }

                            if(suggestion.bugs.too_many_open_recent
                                || suggestion.bugs.open_recent.length == 0){
                                suggestion.open_recent_hidden = true;
                            }else{
                                suggestion.open_recent_hidden = false;
                            }

                            if(suggestion.bugs.too_many_all_others
                                || suggestion.bugs.all_others.length == 0){
                                suggestion.all_others_hidden = true;
                            }else{
                                suggestion.all_others_hidden = false;
                            }



                            suggestions.push(suggestion);
                        });
                        $scope.suggestions = suggestions;


                    }

                })
                .finally(function () {
                    $scope.tabs.failure_summary.is_loading = false;
                });

            }
        };

        $scope.$watch("job.id", update_bugs, true);
    }
]);
