"use strict";

treeherder.controller('TCJobActionsCtrl', [
    '$scope', '$http', '$uibModalInstance', 'ThResultSetStore',
    'ThJobDetailModel', 'thTaskcluster', 'ThTaskclusterErrors',
    'thNotify', 'job', 'repoName', 'resultsetId', 'tcactions',
    function ($scope, $http, $uibModalInstance, ThResultSetStore,
             ThJobDetailModel, thTaskcluster, ThTaskclusterErrors, thNotify,
             job, repoName, resultsetId, tcactions) {
        let jsonSchemaDefaults = require('json-schema-defaults');
        let originalTask;
        $scope.input = {};

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.updateSelectedAction = function () {
            if ($scope.input.selectedAction.schema) {
                $scope.input.jsonPayload = JSON.stringify(jsonSchemaDefaults($scope.input.selectedAction.schema), null, 4);
            } else {
                $scope.input.jsonPayload = undefined;
            }
        };

        $scope.triggerAction = function () {
            $scope.triggering = true;

            let tc = thTaskcluster.client();

            let actionTaskId = tc.slugid();
            tcactions.submit({
                action: $scope.input.selectedAction,
                actionTaskId,
                decisionTaskId: originalTask.taskGroupId,
                taskId: job.taskcluster_metadata.task_id,
                task: originalTask,
                input: $scope.input.jsonPayload ? JSON.parse($scope.input.jsonPayload) : undefined,
                staticActionVariables: $scope.staticActionVariables,
            }).then(function () {
                $scope.$apply(thNotify.send("Custom action request sent successfully", 'success'));
                $scope.triggering = false;
                $uibModalInstance.close('request sent');
            }, function (e) {
                $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', true));
                $scope.triggering = false;
                $uibModalInstance.close('error');
            });
        };

        // prevent closing of dialog while we're triggering
        $scope.$on('modal.closing', function (event) {
            if ($scope.triggering) {
                event.preventDefault();
            }
        });

        ThResultSetStore.getGeckoDecisionTaskId(repoName, resultsetId).then((decisionTaskId) => {
            tcactions.load(decisionTaskId, job).then((results) => {
                originalTask = results.originalTask;
                $scope.actions = results.actions;
                $scope.staticActionVariables = results.staticActionVariables;
                $scope.input.selectedAction = $scope.actions[0];
                $scope.updateSelectedAction();
            });
        });
    }]);
