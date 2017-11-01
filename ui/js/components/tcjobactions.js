'use strict';

treeherder.component('tcJobActions', {
    template: `
        <div class="modal fade tc-job-actions-modal"
             id="job-actions-modal"
             tabindex="-1" role="dialog" aria-labelledby="tc-job-actions-modal" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
        
              <div class="modal-header">
                <h4 class="modal-title" id="tc-job-actions-modalLabel">Custom Taskcluster Job Actions</h4>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div ng-if="!actions" class="modal-body">
                <p class="blink">Getting available actions ...</p>
              </div>
              <div ng-if="actions" class="modal-body">
                <div class="form-group">
                  <label>Action</label>
                  <select aria-describedby="selectedActionHelp" class="form-control" ng-model="input.selectedAction" ng-options="action.title for action in actions" ng-change="updateSelectedAction()">
                  </select>
                  <p id="selectedActionHelp" class="help-block" marked="input.selectedAction.description"></p>
                </div>
                <div class="row">
                  <div class="col-s-12 col-md-6 form-group" ng-if="input.selectedAction.schema">
                    <label>Payload</label>
                    <textarea ng-model="input.payload" class="form-control pre" rows="10" spellcheck=false />
                  </div>
                  <div class="col-s-12 col-md-6 form-group" ng-if="input.selectedAction.schema">
                    <label>Schema</label>
                    <textarea class="form-control pre" rows="10" readonly>{{schema}}</textarea>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button ng-if="user.loggedin" class="btn btn-primary-soft" ng-click="triggerAction()" ng-attr-title="{{user.loggedin ? 'Trigger this action' : 'Not logged in'}}" ng-disabled="triggering">
                  <span class="fa fa-check" aria-hidden="true"></span>
                  <span ng-if="triggering">Triggering</span>
                  <span ng-if="!triggering">Trigger</span>
                </button>
                <p ng-if="!user.loggedin" class="help-block">Custom actions require login</p>
              </div>
        
            </div>
          </div>
        </div>
    `,
    controller: [
        '$scope', '$http', 'ThResultSetStore',
        'ThJobDetailModel', 'thTaskcluster', 'ThTaskclusterErrors',
        'thNotify', 'tcactions',
        'jsyaml', 'Ajv', 'jsonSchemaDefaults',
        function ($scope, $http, ThResultSetStore,
                  ThJobDetailModel, thTaskcluster, ThTaskclusterErrors, thNotify,
                  tcactions, jsyaml, Ajv, jsonSchemaDefaults) {
            const ajv = new Ajv({
                format: 'full',
                verbose: true,
                allErrors: true
            });
            let decisionTaskId;
            let originalTaskId;
            let originalTask;
            let validate;
            $scope.input = {};

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

                let tc = thTaskcluster.client();

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

                let actionTaskId = tc.slugid();
                tcactions.submit({
                    action: $scope.input.selectedAction,
                    actionTaskId,
                    decisionTaskId,
                    taskId: originalTaskId,
                    task: originalTask,
                    input,
                    staticActionVariables: $scope.staticActionVariables,
                }).then(function () {
                    $scope.triggering = false;
                    let message = 'Custom action request sent successfully:';
                    let url = `https://tools.taskcluster.net/tasks/${actionTaskId}`;

                    // For the time being, we are redirecting specific actions to
                    // specific urls that are different than usual. At this time, we are
                    // only directing loaner tasks to the loaner UI in the tools site.
                    // It is possible that we may make this a part of the spec later.
                    const loaners = ['docker-worker-linux-loaner', 'generic-worker-windows-loaner'];
                    if (_.includes(loaners, $scope.input.selectedAction.name)) {
                        message = 'Visit Taskcluster Tools site to access loaner:';
                        url = `${url}/connect`;
                    }
                    $scope.$apply(thNotify.send(message, 'success', {
                        linkText: 'Open in Taskcluster',
                        url,
                    }));
                    $('job-actions-modal').modal('hide');
                }, function (e) {
                    $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true }));
                    $scope.triggering = false;
                    $('job-actions-modal').modal('hide');
                });
            };

            // prevent closing of dialog while we're triggering
            $scope.$on('modal.closing', function (event) {
                if ($scope.triggering) {
                    event.preventDefault();
                }
            });

            $('#job-actions-modal').on('show.bs.modal', function (event) {
                const button = $(event.relatedTarget); // Button that triggered the modal
                const job = button.data('job');
                const repoName = button.data('repo-name');
                const resultsetId = button.data('resultset-id');

                ThResultSetStore.getGeckoDecisionTaskId(repoName, resultsetId).then((dtId) => {
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

            });

        }]
});
