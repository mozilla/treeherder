"use strict";

treeherder.controller('TCJobActionsCtrl', [
    '$scope', '$http', '$uibModalInstance', 'ThResultSetStore',
    'ThJobDetailModel', 'thTaskcluster', 'ThTaskclusterErrors',
    'thNotify', 'job', 'repoName', 'resultsetId', 'actionsRender',
    function($scope, $http, $uibModalInstance, ThResultSetStore,
             ThJobDetailModel, thTaskcluster, ThTaskclusterErrors, thNotify,
             job, repoName, resultsetId, actionsRender) {
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

            let tc = thTaskcluster.client();

            let actionTaskId = tc.slugid();
            let actionTask = actionsRender($scope.input.selectedAction.task, _.defaults({}, {
                taskGroupId: originalTask.taskGroupId,
                taskId: job.taskcluster_metadata.task_id,
                task: originalTask,
                input: JSON.parse($scope.input.jsonPayload),
            }, $scope.staticActionVariables));

            let queue = new tc.Queue();
            queue.createTask(actionTaskId, actionTask).then(function() {
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

        let decisionTask = ThResultSetStore.getGeckoDecisionJob(repoName, resultsetId);
        if (decisionTask) {
            let originalTaskId = job.taskcluster_metadata.task_id;
            $http.get('https://queue.taskcluster.net/v1/task/' + originalTaskId).then(
                function(response) {
                    originalTask = response.data;
                    ThJobDetailModel.getJobDetails({
                        job_id: decisionTask.id,
                        title: 'artifact uploaded',
                        value: 'actions.json'}).then(function(details) {
                            if (!details.length) {
                                alert("Could not find actions.json");
                                return;
                            }

                            let actionsUpload = details[0];
                            return $http.get(actionsUpload.url).then(function(response) {
                                if (response.data.version !== 1) {
                                    alert("Wrong version of actions.json, can't continue");
                                    return;
                                }
                                $scope.staticActionVariables = response.data.variables;
                                // only display actions which should be displayed
                                // in this task's context
                                $scope.actions = response.data.actions.filter(function(action) {
                                    return action.kind === 'task' && _.every((action.context || []).map(function(actionContext) {
                                        return _.every(_.map(actionContext, function(v, k) {
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
            alert("No decision task, can't find taskcluster actions");
        }

    }]);
