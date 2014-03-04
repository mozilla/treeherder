"use strict";

treeherder.controller('BugClassificationCtrl',
    function BugClassificationCtrl($scope, ThBugJobMapModel, $modalInstance){

        $scope.failure_classification_id = null;
        $scope.comment = "";
        angular.forEach($scope.selected_bugs, function(bug_id, selected){
            if(selected){
                if($scope.comment !== ""){
                    $scope.comment += ",";
                }
                $scope.comment += "Bug #"+bug_id;
            }
        });
        $scope.custom_bug = null;

        $scope.ok = function () {
            angular.forEach($scope.selected_bugs, function(bug_id, selected){
                if(selected){
                    var bug_job_map = new ThBugJobMapModel({
                        bug_id: bug_id,
                        job_id: $scope.job.id
                    });
                    bug_job_map.create();
                }
            });
            $modalInstance.close();
        };

        $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
        };
    });

treeherder.controller('BugsPluginCtrl',
    function BugsPluginCtrl($scope, $rootScope, $log, ThJobArtifactModel,
                            ThBugJobMapModel, ThJobNoteModel, thNotify, $modal) {
        $log.debug("bugs plugin initialized");

        $scope.classify = function(bug_list){
            var modalInstance = $modal.open({
                templateUrl: 'bug_classification.html',
                controller: 'BugClassificationCtrl',
                resolve: {'result':'ok'},
                scope: $scope
            });
        };
        $scope.message = "";

        $scope.quick_submit = function(){
            angular.forEach($scope.selected_bugs, function(v, k){
                if(v){
                    var bjm = new ThBugJobMapModel({
                        bug_id : k,
                        job_id: $scope.job.id,
                        type: 'annotation'
                    });
                    bjm.create();
                }
            });
            var note = new ThJobNoteModel({
                job_id:$scope.job.id,
                who: $scope.user ? $scope.user.email : "",
                failure_classification_id: $scope.classification,
                note_timestamp: new Date().getTime(),
                note: ""
            });
            note.create()
            .then(
                function(){
                    thNotify.send({
                        message: "Note successfully created",
                        severity: "success",
                        sticky: false
                    });
                },
                function(){
                    thNotify.send({
                        message: "Note creation failed",
                        severity: "danger",
                        sticky: true
                    });
                }
            );
        };

        var update_bugs = function(newValue, oldValue){
            $scope.bugs = {};
            $scope.visible = "open";
            $scope.show_all = false;
            $scope.selected_bugs = {};
            $scope.classification = null;


            // fetch artifacts only if the job is finished
            if(newValue){
                $scope.tabs.bugs_suggestions.is_loading = true;
                var data = ThJobArtifactModel.get_list({
                    name__in: "Open bugs,Closed bugs",
                    "type": "json",
                    job_id: newValue
                })
                .then(function(response){
                    // iterate to retrieve the total num of suggestions
                    angular.forEach(response, function(artifact){
                        var open_closed = artifact.name === "Open bugs" ? "open" : "closed";
                        angular.forEach(artifact.blob, function(suggestions, error){
                            if(!_.has($scope.bugs, error)){
                                $scope.bugs[error] = {'open':[], 'closed':[]};
                            }
                            $scope.bugs[error][open_closed] = suggestions;
                        });
                    });
                })
                .finally(function(){
                    $scope.tabs.bugs_suggestions.is_loading = false;
                });
            }
        };

        $scope.$watch("job.id", update_bugs, true);
    }
);
