// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, object-shorthand, prefer-template, radix */
import defaults from 'lodash/defaults';
import set from 'lodash/set';

import perf from '../../perf';
import { endpoints } from '../../../perfherder/constants';
import {
    alertIsOfState,
    getAlertSummaries,
    getAlertSummary,
    getIssueTrackerUrl,
    getTextualSummary,
    modifySelectedAlerts,
    refreshAlertSummary,
} from '../../../perfherder/helpers';
import modifyAlertsCtrlTemplate from '../../../partials/perf/modifyalertsctrl.html';
import { getApiUrl, getJobsUrl } from '../../../helpers/url';
import { getData } from '../../../helpers/http';
import {
  thDateFormat,
  phTimeRanges,
  phDefaultTimeRangeValue,
  phTimeRangeValues,
  phAlertSummaryStatusMap,
  phAlertStatusMap,
} from '../../../helpers/constants';
import OptionCollectionModel from '../../../models/optionCollection';
import PushModel from '../../../models/push';
import RepositoryModel from '../../../models/repository';

perf.controller(
    'MarkDownstreamAlertsCtrl', ['$scope', '$uibModalInstance', '$q', 'alertSummary',
        'allAlertSummaries',
        function ($scope, $uibModalInstance, $q, alertSummary, allAlertSummaries) {
            $scope.title = 'Mark alerts downstream';
            $scope.placeholder = 'Alert #';

            $scope.update = () => {
                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                modifySelectedAlerts(alertSummary, {
                    status: phAlertStatusMap.DOWNSTREAM.id,
                    related_summary_id: newId,
                }).then(() => {
                        const summariesToUpdate = [alertSummary].concat(
                            allAlertSummaries.find(alertSummary =>
                                alertSummary.id === newId) || []);
                        $q.all(summariesToUpdate.map(alertSummary => refreshAlertSummary(alertSummary),
                      )).then(() => $uibModalInstance.close('downstreamed'));
                    });
            };
            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };
            $scope.$on('modal.closing', function (event) {
                if ($scope.modifying) {
                    event.preventDefault();
                }
            });
        }]);

perf.controller(
    'ReassignAlertsCtrl', ['$scope', '$uibModalInstance', '$q', 'alertSummary',
        'allAlertSummaries',
        function ($scope, $uibModalInstance, $q, alertSummary, allAlertSummaries) {

            $scope.title = 'Reassign alerts';
            $scope.placeholder = 'Alert #';

            $scope.update = function () {

                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                // FIXME: validate that new summary id is on same repository?
                modifySelectedAlerts(alertSummary, {
                    status: phAlertStatusMap.REASSIGNED.id,
                    related_summary_id: newId,
                }).then(function () {
                    // FIXME: duplication with downstream alerts controller
                    const summariesToUpdate = [alertSummary].concat(
                        allAlertSummaries.find(alertSummary =>
                          alertSummary.id === newId) || []);
                    $q.all(summariesToUpdate.map(alertSummary => refreshAlertSummary(alertSummary),
                  )).then(() => $uibModalInstance.close('downstreamed'));
                });
            };
            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };
            $scope.$on('modal.closing', function (event) {
                if ($scope.modifying) {
                    event.preventDefault();
                }
            });
        }]);

perf.controller('AlertsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$uibModal',
    'dateFilter',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $q, $uibModal,
                        dateFilter) {
        $scope.alertSummaries = undefined;
        $scope.getMoreAlertSummariesHref = null;

        // can filter by alert statuses or just show everything
        $scope.statuses = Object.values(phAlertSummaryStatusMap);
        $scope.statuses = $scope.statuses.concat({ id: -1, text: 'all' });

        $scope.updateAlertVisibility = function() {
            $scope.alertSummaries.forEach(function (alertSummary) {
                alertSummary.alerts.forEach(function (alert) {
                    // only show alert if it passes all filter criteria
                    // also hide downstream alerts that are not directly related
                    // to this summary (FIXME: maybe show something underneath
                    // the alert like "XX downstream alerts not shown" and provide
                    // a button to disclose them? ... see
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1247028)
                    alert.visible =
                        (!$scope.filterOptions.hideImprovements || alert.is_regression) &&
                        (alert.summary_id === alertSummary.id ||
                         alert.status !== phAlertStatusMap.DOWNSTREAM.id) &&
                        !($scope.filterOptions.hideDwnToInv && alert.status === phAlertStatusMap.REASSIGNED.id &&
                          alert.related_summary_id !== alertSummary.id) &&
                        !($scope.filterOptions.hideDwnToInv && alert.status === phAlertStatusMap.DOWNSTREAM.id) &&
                        !($scope.filterOptions.hideDwnToInv && alert.status === phAlertStatusMap.INVALID.id) &&
                        $scope.filterOptions.filter.split(' ').every((matchText) => {
                            const result = !matchText ||
                                alert.title.toLowerCase().indexOf(
                                    matchText.toLowerCase()) > (-1) ||
                                (alertSummary.bug_number && alertSummary.bug_number.toString().includes(
                                    matchText)) ||
                                (alertSummary.resultSetMetadata.revision.includes(matchText));
                            return result;
                        });
                    // reset alert's selected status if it is no longer visible
                    alert.selected = alert.selected && alert.visible;
                });
                alertSummary.anyVisible = alertSummary.alerts.map(x => x.visible).some(x => x);

                // if all are selected with this alert summary, update which
                // ones are selected
                if (alertSummary.allSelected) {
                    $scope.selectNoneOrSelectAll(alertSummary);
                }
            });
            $scope.numFilteredAlertSummaries = $scope.alertSummaries.filter(summary => !summary.anyVisible).length;
        }

        // these methods handle the business logic of alert selection and
        // unselection
        $scope.anySelected = function (alerts) {
            return alerts.map(alert => alert.selected).some(x => x);
        };
        $scope.anySelectedAndTriaged = function (alerts) {
            return alerts.map(alert => !alertIsOfState(alert, phAlertStatusMap.UNTRIAGED) && alert.selected).some(x => x);
        };
        $scope.allSelectedAreConfirming = function (alerts) {
            return alerts.filter(alert => alert.selected).map(alert => alertIsOfState(alert, phAlertStatusMap.CONFIRMING)).every(x => x);
        };
        $scope.selectNoneOrSelectAll = function (alertSummary) {
            // if some are not selected, then select all if checked
            // otherwise select none
            alertSummary.alerts.forEach(function (alert) {
                alert.selected = alert.visible && alertSummary.allSelected;
            });
        };

        // TODO replace usage of modifyAlertsCtrlTemplate with Bug Modal component
        $scope.markAlertsDownstream = function (alertSummary) {
            $uibModal.open({
                template: modifyAlertsCtrlTemplate,
                controller: 'MarkDownstreamAlertsCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function () {
                        return alertSummary;
                    },
                    allAlertSummaries: function () {
                        return $scope.alertSummaries;
                    },
                },
            }).result.then(function () {
                $scope.updateAlertVisibility();
            });
        };
        $scope.reassignAlerts = function (alertSummary) {
            $uibModal.open({
                template: modifyAlertsCtrlTemplate,
                controller: 'ReassignAlertsCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function () {
                        return alertSummary;
                    },
                    allAlertSummaries: function () {
                        return $scope.alertSummaries;
                    },
                },
            }).result.then(function () {
                $scope.updateAlertVisibility();
            });
        };

        function updateAlertSummary(alertSummary) {
            refreshAlertSummary(alertSummary).then(function () {
                $scope.updateAlertVisibility();
                $scope.$digest();
            });
        }
        $scope.markAlertsConfirming = function (alertSummary) {
            modifySelectedAlerts(alertSummary, {
                status: phAlertStatusMap.CONFIRMING.id,
            }).then(
                function () {
                    updateAlertSummary(alertSummary);
                });
        };
        $scope.markAlertsAcknowledged = function (alertSummary) {
            modifySelectedAlerts(alertSummary, {
                status: phAlertStatusMap.ACKNOWLEDGED.id,
            }).then(
                function () {
                    updateAlertSummary(alertSummary);
                });
        };
        $scope.markAlertsInvalid = function (alertSummary) {
            modifySelectedAlerts(alertSummary, {
                status: phAlertStatusMap.INVALID.id,
            }).then(
                function () {
                    updateAlertSummary(alertSummary);
                });
        };

        $scope.resetAlerts = function (alertSummary) {
            // We need to update not only the summary when resetting the alert,
            // but other summaries affected by the change
            const summariesToUpdate = [alertSummary].concat((
                alertSummary.alerts.filter(alert => alert.selected).map(
                alert => ($scope.alertSummaries.find(alertSummary =>
                        alertSummary.id === alert.related_summary_id)),
                )).filter(alertSummary => alertSummary !== undefined));

            modifySelectedAlerts(alertSummary, {
                status: phAlertStatusMap.UNTRIAGED.id,
                related_summary_id: null,
            }).then(
                function () {
                    // update the alert summaries appropriately
                    summariesToUpdate.forEach((alertSummary) => {
                        updateAlertSummary(alertSummary);
                    });
                });
        };
        // TODO this has been replaced
        function addAlertSummaries(alertSummaries, getMoreAlertSummariesHref) {
            $scope.getMoreAlertSummariesHref = getMoreAlertSummariesHref;

            // create a mapping of result set information -> alert summaries,
            // so we can fill in revision information for each alert summary
            // (this is sadly easier to do on the client side than the server
            // right now, because all the result set information is in a
            // different database than the perf data)
            const resultSetToSummaryMap = {};
            alertSummaries.forEach(function (alertSummary) {
                // initialize summary map for this repository, if not already
                // initialized
                defaults(resultSetToSummaryMap,
                           set({}, alertSummary.repository, {}));
                // TODO is this needed or can originalNotes prop be removed?
                alertSummary.originalNotes = alertSummary.notes;

                [alertSummary.push_id, alertSummary.prev_push_id].forEach(
                    function (resultSetId) {
                        // skip nulls
                        if (resultSetId === null) return;
                        const repoMap = resultSetToSummaryMap[alertSummary.repository];
                        // initialize map for this result set, if not already
                        // initialized
                        defaults(repoMap, set({}, resultSetId, []));
                        repoMap[resultSetId].push(alertSummary);
                    });
            });

            $q.all(Object.keys(resultSetToSummaryMap).map(async repo => {
                // TODO utilize failureStatus from PushModel.getList for error handling; set count param equal to length of id's
                const push_ids = Object.keys(resultSetToSummaryMap[repo]);
                const { data } = await PushModel.getList({ repo, id__in: push_ids.join(','), count: push_ids.length });
                data.results.forEach((resultSet) => {
                    resultSet.dateStr = dateFilter(
                        resultSet.push_timestamp * 1000, thDateFormat);
                    // want at least 14 days worth of results for relative comparisons
                    const timeRange = phTimeRangeValues[repo] ? phTimeRangeValues[repo] : phDefaultTimeRangeValue;
                    resultSet.timeRange = Math.max(timeRange,
                        phTimeRanges.map(timeRange => timeRange.value).find(
                        t => ((Date.now() / 1000.0) - resultSet.push_timestamp) < t));
                    resultSetToSummaryMap[repo][resultSet.id].forEach(
                            (summary) => {
                                if (summary.push_id === resultSet.id) {
                                    summary.resultSetMetadata = resultSet;
                                } else if (summary.prev_push_id === resultSet.id) {
                                    summary.prevResultSetMetadata = resultSet;
                                }
                            });
                });
            })).then(() => {
                // for all complete summaries, fill in job and pushlog links
                // and downstream summaries
                alertSummaries.forEach((summary) => {
                    const repo = $rootScope.repos.find(repo =>
                        repo.name === summary.repository);

                    if (summary.prevResultSetMetadata &&
                        summary.resultSetMetadata) {
                        summary.jobsURL = getJobsUrl({
                            repo: summary.repository,
                            fromchange: summary.prevResultSetMetadata.revision,
                            tochange: summary.resultSetMetadata.revision });
                        summary.pushlogURL = repo.getPushLogRangeHref({
                            fromchange: summary.prevResultSetMetadata.revision,
                            tochange: summary.resultSetMetadata.revision,
                        });
                    }

                    summary.downstreamSummaryIds = [...new Set((
                      summary.alerts.map((alert) => {
                        if (alert.status === phAlertStatusMap.DOWNSTREAM.id &&
                            alert.summary_id !== summary.id) {
                          return [alert.summary_id];
                        }
                        return [];
                      })).reduce((a, b) => [...a, ...b], []))];
                });

                // update master list + visibility
                if ($scope.alertSummaries === undefined) {
                    $scope.alertSummaries = alertSummaries;
                } else {
                    $scope.alertSummaries = [...new Set([
                        ...$scope.alertSummaries,
                        ...alertSummaries])];
                }
                $scope.updateAlertVisibility();
            });
            // console.log(resultSetToSummaryMap);
            // console.log(alertSummaries)
        }

        $scope.getMoreAlertSummaries = function () {
            getAlertSummaries({ href: $scope.getMoreAlertSummariesHref }).then(
                function (data) {
                    addAlertSummaries(data.results, data.next);
                });
        };

        $scope.alertSummaryCount = 0;
        $scope.alertSummaryCurrentPage = 1;
        $scope.alertSummaryPageSize = 10;
        $scope.getAlertSummariesPage = function () {
            getAlertSummaries({
                page: $scope.alertSummaryCurrentPage,
                statusFilter: $scope.filterOptions.status.id,
                frameworkFilter: $scope.filterOptions.framework.id,
            }).then(function (data) {
                $scope.alertSummaries = undefined;
                addAlertSummaries(data.results, data.next);
                $scope.alertSummaryCount = data.count;
                $state.go('.', { page: $scope.alertSummaryCurrentPage }, { notify: false });
            });
        };

        $scope.filtersUpdated = function () {
            const statusFilterChanged = (parseInt($state.params.status) !==
                                       $scope.filterOptions.status.id);
            const frameworkFilterChanged = (parseInt($state.params.framework) !==
                                          $scope.filterOptions.framework.id);

            $state.transitionTo('alerts', {
                status: $scope.alertId ? undefined : $scope.filterOptions.status.id,
                framework: $scope.alertId ? undefined : $scope.filterOptions.framework.id,
                filter: $scope.filterOptions.filter,
                hideImprovements: $scope.filterOptions.hideImprovements ? 1 : undefined,
                hideDwnToInv: $scope.filterOptions.hideDwnToInv ? 1 : undefined,
                page: 1,
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false,
            });

            if (!$scope.alertId && (statusFilterChanged || frameworkFilterChanged)) {
                // if the status or framework filter changed (and we're not looking
                // at an individual summary), we should reload everything
                $scope.alertSummaries = undefined;
                getAlertSummaries({
                    statusFilter: $scope.filterOptions.status.id,
                    frameworkFilter: $scope.filterOptions.framework.id,
                }).then(
                    function (data) {
                        addAlertSummaries(data.results, data.next);
                        $scope.alertSummaryCount = data.count;
                        $scope.alertSummaryCurrentPage = 1;
                    });
            } else {
                $scope.updateAlertVisibility();
            }
        };

        $scope.phAlertStatusMap = phAlertStatusMap;
        $scope.alertIsOfState = alertIsOfState;

        // AlertSummary functions
        $scope.phAlertSummaryStatusMap = phAlertSummaryStatusMap;
        $scope.getIssueTrackerUrl = getIssueTrackerUrl;
        $scope.getTextualSummary = getTextualSummary;
        // TODO this was fetched  and replaced by Validation component
        RepositoryModel.getList().then((repos) => {
            $rootScope.repos = repos;
            $q.all([getData(getApiUrl(endpoints.frameworks)).then(({ data: frameworks }) => {
                $scope.frameworks = frameworks;
                // this doesn't seem to be needed
            }), OptionCollectionModel.getMap().then(function (optionCollectionMap) {
                $scope.optionCollectionMap = optionCollectionMap;
            })]).then(function () {
                $scope.filterOptions = {
                    status: $scope.statuses.find(status =>
                        status.id === parseInt($stateParams.status),
                    ) || $scope.statuses[0],
                    framework: $scope.frameworks.find(fw =>
                        fw.id === parseInt($stateParams.framework),
                    ) || $scope.frameworks[0],
                    filter: $stateParams.filter || '',
                    hideImprovements: $stateParams.hideImprovements !== undefined &&
                    parseInt($stateParams.hideImprovements),
                    hideDwnToInv: $stateParams.hideDwnToInv !== undefined &&
                    parseInt($stateParams.hideDwnToInv),
                    page: $stateParams.page || 1,
                };
                if ($stateParams.hideDwnToInv) {
                    $scope.filterOptions.hideDwnToInv = true;
                }
                if ($stateParams.id) {
                    $scope.alertId = $stateParams.id;
                    getAlertSummary($stateParams.id).then(
                        function (data) {
                            addAlertSummaries([data], null);
                        });
                } else {
                    getAlertSummaries({
                        statusFilter: $scope.filterOptions.status.id,
                        frameworkFilter: $scope.filterOptions.framework.id,
                        page: $scope.filterOptions.page,
                    }).then(
                        function (data) {
                            addAlertSummaries(data.results, data.next);
                            $scope.alertSummaryCurrentPage = $scope.filterOptions.page;
                            $scope.alertSummaryCount = data.count;
                        });
                }
            });
        });
    },
]);
