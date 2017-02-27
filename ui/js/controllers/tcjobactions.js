"use strict";

treeherder.controller('TCJobActionsCtrl', [
    '$scope', '$http', '$uibModalInstance', 'ThResultSetStore',
    'ThJobDetailModel', 'thTaskcluster', 'ThTaskclusterErrors',
    'thNotify', 'job', 'repoName', 'resultsetId',
    function($scope, $http, $uibModalInstance, ThResultSetStore,
             ThJobDetailModel, thTaskcluster, ThTaskclusterErrors, thNotify,
             job, repoName, resultsetId) {
        let originalTask;
        $scope.input = {};

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.updateSelectedAction = function() {
            $scope.input.jsonPayload = JSON.stringify(jsonSchemaDefaults($scope.input.selectedAction.schema), null, 4);
        };

        $scope.triggerAction = function() {
            $scope.triggering = true;

            let task = _.clone($scope.input.selectedAction.task);
            // update the various date properties with evaluations
            task = thTaskcluster.refreshTimestamps(task);
            // fixme: it seems like action tasks define these properties as
            // something we're supposed to evaluate, but I feel to see the
            // advantage of doing so vs. just calling the above function
            //['created', 'deadline', 'expires'].map(function(dateProp) {
            // task[dateProp] = thTaskcluster.fromNow(task[dateProp]['$fromNow']);
            //});
            task.payload.env['ACTION_INPUT'] = $scope.input.jsonPayload;
            task.payload.env['ACTION_PARAMETERS'] = null; // fixme: unclear what to set this to
            task.payload.env['ACTION_TASK'] = null; // fixme: what is this supposed to do?
            task.payload.env['ACTION_TASK_ID'] = JSON.stringify(job.taskcluster_metadata.task_id);
            task.payload.env['ACTION_TASK_GROUP_ID'] = JSON.stringify(originalTask.taskGroupId);

            let tc = thTaskcluster.client();
            let queue = new tc.Queue();
            let taskId = tc.slugid();
            queue.createTask(taskId, task).then(function() {
                $scope.$apply(thNotify.send("Custom action request sent successfully", 'success'));
                $scope.triggering = false;
                $uibModalInstance.close('request sent');
            }, function(e) {
                $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', true));
                $scope.triggering = false;
                $uibModalInstance.close('error');
            });
        };

        // prevent closing of dialog while we're triggering
        $scope.$on('modal.closing', function(event) {
            if ($scope.triggering) {
                event.preventDefault();
            }
        });

        let decisionTaskGUID = ThResultSetStore.getGeckoDecisionTaskGUID(repoName, resultsetId);
        if (decisionTaskGUID) {
            let originalTaskId = job.taskcluster_metadata.task_id;
            $http.get('https://queue.taskcluster.net/v1/task/' + originalTaskId).then(
                function(response) {
                    originalTask = response.data;
                    ThJobDetailModel.getJobDetails({
                        job_guid: decisionTaskGUID,
                        title: 'artifact uploaded',
                        value: 'actions.json'}).then(function(details) {
                            if (!details.length) {
                                alert("Could not find actions.json");
                                return;
                            }

                            let actionsUpload = details[0];
                            return $http.get(actionsUpload.url).then(function(response) {
                                // only display actions which should be displayed
                                // in this task's context
                                $scope.actions = response.data.actions.filter(function(action) {
                                    return _.any(action.context.map(function(actionContext) {
                                        return _.all(_.map(actionContext, function(v, k) {
                                            return (originalTask.tags[k] === v);
                                        }));
                                    }));
                                });
                                $scope.input.selectedAction = $scope.actions[0];
                                $scope.updateSelectedAction();
                            });
                        });
                });
        } else {
            alert("No decision task GUID, can't find taskcluster actions");
        }

    }]);
