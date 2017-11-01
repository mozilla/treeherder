'use strict';

treeherder.component('modifyAlertSummary', {
    template: `
        <div class="modal fade" id="modify-alerts-modal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-sm" role="document">
            <div class="modal-content">
                <ng-include src="'partials/perf/modifyalertsctrl.html'" />    
            </div>
          </div>
        </div>
    `,
    bindings: {
        updateAlertVisibility: "<"
    },
    controller: ['$scope',
        function ($scope) {
            const ctrl = this;
            let alertSummary;
            $('#modify-alerts-modal').on('show.bs.modal', function (event) {
                const target = $(event.relatedTarget);
                alertSummary = target.data('alert-summary');
            });
            $scope.title = "Link to bug";
            $scope.placeholder = "Bug #";

            $scope.update = function () {
                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                $scope.modifying = true;
                alertSummary.assignBug(newId).then(function () {
                    $scope.modifying = false;
                    $('#modify-alerts-modal').modal('hide');
                });
            };

            $scope.$on('modal.closing', function (event) {
                if ($scope.modifying) {
                    ctrl.updateAlertVisibility();
                    event.preventDefault();
                }
            });
        }]
});

treeherder.component('markDownstreamAlerts', {
    template: `
        <div class="modal fade" id="mark-downstream-alerts-modal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-sm" role="document">
            <div class="modal-content">
                <ng-include src="'partials/perf/modifyalertsctrl.html'" />    
            </div>
          </div>
        </div>
    `,
    bindings: {
        allAlertSummaries: "<",
        updateAlertVisibility: "<"
    },
    controller: ['$scope', '$http', '$q', 'PhAlerts', 'phAlertStatusMap',
        function ($scope, $http, $q, PhAlerts, phAlertStatusMap) {
            const ctrl = this;
            let alertSummary;

            $('#mark-downstream-alerts-modal').on('show.bs.modal', function (event) {
                const target = $(event.relatedTarget);
                alertSummary = target.data('alert-summary');
            });
            $scope.title = "Mark alerts downstream";
            $scope.placeholder = "Alert #";

            $scope.update = function () {
                var newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                alertSummary.modifySelectedAlerts({
                    status: phAlertStatusMap.DOWNSTREAM.id,
                    related_summary_id: newId
                }).then(
                    function () {
                        var summariesToUpdate = [alertSummary].concat(
                            _.find(ctrl.allAlertSummaries, function (alertSummary) {
                                return alertSummary.id === newId;
                            }) || []);
                        $q.all(_.map(summariesToUpdate, function (alertSummary) {
                            return alertSummary.update();
                        })).then(function () {
                            $('#mark-downstream-alerts-modal').modal('hide');

                        });
                    });
            };
            $scope.$on('modal.closing', function (event) {
                if ($scope.modifying) {
                    ctrl.updateAlertVisibility();
                    event.preventDefault();
                }
            });
        }]
});

treeherder.component('reassignAlerts', {
    template: `
        <div class="modal fade" id="reassign-alerts-modal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-sm" role="document">
            <div class="modal-content">
                <ng-include src="'partials/perf/modifyalertsctrl.html'" />    
            </div>
          </div>
        </div>
    `,
    bindings: {
        allAlertSummaries: "<",
        updateAlertVisibility: "<"
    },
    controller: ['$scope', '$http', '$q', 'PhAlerts', 'phAlertStatusMap',
        function ($scope, $http, $q, PhAlerts, phAlertStatusMap) {
            const ctrl = this;
            let alertSummary;

            $('#reassign-alerts-modal').on('show.bs.modal', function (event) {
                const target = $(event.relatedTarget);
                alertSummary = target.data('alert-summary');
            });

            $scope.title = "Reassign alerts";
            $scope.placeholder = "Alert #";

            $scope.update = function () {

                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                // FIXME: validate that new summary id is on same repository?
                alertSummary.modifySelectedAlerts({
                    status: phAlertStatusMap.REASSIGNED.id,
                    related_summary_id: newId
                }).then(function () {
                    // FIXME: duplication with downstream alerts controller
                    const summariesToUpdate = [alertSummary].concat(
                        _.find(ctrl.allAlertSummaries, function (alertSummary) {
                            return alertSummary.id === newId;
                        }) || []);
                    $q.all(_.map(summariesToUpdate, function (alertSummary) {
                        return alertSummary.update();
                    })).then(function () {
                        $('#reassign-alerts-modal').modal('hide');
                    });
                });
            };
            $scope.$on('modal.closing', function (event) {
                if ($scope.modifying) {
                    ctrl.updateAlertVisibility();
                    event.preventDefault();
                }
            });
        }]
});

