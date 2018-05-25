import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import jsyaml from 'js-yaml';
import { slugid } from 'taskcluster-client-web';

import treeherder from '../treeherder';
import { formatTaskclusterError } from '../../helpers/errorMessage';

treeherder.controller('TCJobActionsCtrl', [
    '$scope', '$uibModalInstance', 'ThResultSetStore',
    'thNotify', 'job', 'repoName', 'resultsetId', 'tcactions',
    function ($scope, $uibModalInstance, ThResultSetStore,
             thNotify,
             job, repoName, resultsetId, tcactions) {
        const ajv = new Ajv({ format: 'full', verbose: true, allErrors: true });
        let decisionTaskId;
        let originalTaskId;
        let originalTask;
        let validate;
        $scope.input = {};

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.updateSelectedAction = function () {
            if ($scope.input.selectedAction.schema) {
                $scope.schema = jsyaml.safeDump($scope.input.selectedAction.schema);
                $scope.input.payload = jsyaml.safeDump(jsonSchemaDefaults($scope.input.selectedAction.schema));
                validate = ajv.compile($scope.input.selectedAction.schema);
            } else {
                $scope.input.payload = undefined;
                $scope.schema = undefined;
                validate = undefined;
            }
        };

        $scope.triggerAction = function () {
            $scope.triggering = true;

            let input = null;
            if (validate && $scope.input.payload) {
                try {
                    input = jsyaml.safeLoad($scope.input.payload);
                } catch (e) {
                    $scope.triggering = false;
                    thNotify.send(`YAML Error: ${e.message}`, 'danger');
                    return;
                }
                const valid = validate(input);
                if (!valid) {
                    $scope.triggering = false;
                    thNotify.send(ajv.errorsText(validate.errors), 'danger');
                    return;
                }
            }

            tcactions.submit({
                action: $scope.input.selectedAction,
                actionTaskId: slugid(),
                decisionTaskId,
                taskId: originalTaskId,
                task: originalTask,
                input,
                staticActionVariables: $scope.staticActionVariables,
            }).then(function (taskId) {
                $scope.triggering = false;
                let message = 'Custom action request sent successfully:';
                let url = `https://tools.taskcluster.net/tasks/${taskId}`;

                // For the time being, we are redirecting specific actions to
                // specific urls that are different than usual. At this time, we are
                // only directing loaner tasks to the loaner UI in the tools site.
                // It is possible that we may make this a part of the spec later.
                const loaners = ['docker-worker-linux-loaner', 'generic-worker-windows-loaner'];
                if (loaners.indexOf($scope.input.selectedAction.name) !== -1) {
                    message = 'Visit Taskcluster Tools site to access loaner:';
                    url = `${url}/connect`;
                }
                $scope.$apply(thNotify.send(message, 'success', {
                    linkText: 'Open in Taskcluster',
                    url,
                }));
                $uibModalInstance.close('request sent');
            }, function (e) {
                $scope.$apply(thNotify.send(formatTaskclusterError(e), 'danger', { sticky: true }));
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

        ThResultSetStore.getGeckoDecisionTaskId(resultsetId).then((dtId) => {
            decisionTaskId = dtId;
            tcactions.load(decisionTaskId, job).then((results) => {
                originalTask = results.originalTask;
                originalTaskId = results.originalTaskId;
                $scope.actions = results.actions;
                $scope.staticActionVariables = results.staticActionVariables;
                $scope.input.selectedAction = $scope.actions[0];
                $scope.updateSelectedAction();
            });
        });
    }]);
