import _ from 'lodash';
import angular from 'angular';

import perf from '../../perf';
import modifyAlertsCtrlTemplate from '../../../partials/perf/modifyalertsctrl.html';
import editAlertSummaryNotesCtrlTemplate from '../../../partials/perf/editnotesctrl.html';
import { getApiUrl, getJobsUrl } from '../../../helpers/url';
import {
  thDateFormat,
  phTimeRanges,
  phDefaultTimeRangeValue,
  phTimeRangeValues,
  phAlertSummaryStatusMap,
  phAlertStatusMap,
} from '../../constants';
import OptionCollectionModel from '../../../models/optionCollection';

perf.factory('PhBugs', [
    '$http', '$httpParamSerializer', '$interpolate', '$rootScope', 'dateFilter',
    function ($http, $httpParamSerializer, $interpolate, $rootScope, dateFilter) {
        return {
            fileBug: function (alertSummary) {
                $http.get(getApiUrl(`/performance/bug-template/?framework=${alertSummary.framework}`)).then(function (response) {
                    const template = response.data[0];
                    const repo = _.find($rootScope.repos, { name: alertSummary.repository });
                    const compiledText = $interpolate(template.text)({
                        revisionHref: repo.getPushLogHref(alertSummary.resultSetMetadata.revision),
                        alertHref: window.location.origin + '/perf.html#/alerts?id=' +
                            alertSummary.id,
                        alertSummary: alertSummary.getTextualSummary(),
                    });
                    const pushDate = dateFilter(
                        alertSummary.resultSetMetadata.push_timestamp * 1000,
                        'EEE MMM d yyyy');
                    const bugTitle = alertSummary.getTitle() +
                        ' regression on push ' +
                        alertSummary.resultSetMetadata.revision + ' (' +
                        pushDate + ')';
                    window.open(
                        'https://bugzilla.mozilla.org/enter_bug.cgi?' + $httpParamSerializer({
                            cc: template.cc_list,
                            comment: compiledText,
                            component: template.default_component,
                            product: template.default_product,
                            keywords: template.keywords,
                            short_desc: bugTitle,
                            status_whiteboard: template.status_whiteboard,
                        }));
                });
            },
        };
    }]);

perf.controller(
    'ModifyAlertSummaryCtrl', ['$scope', '$uibModalInstance', 'alertSummary', 'PhIssueTracker',
        function ($scope, $uibModalInstance, alertSummary, PhIssueTracker) {
            $scope.title = 'Link to bug';
            $scope.placeholder = 'Task #';
            $scope.issueTrackers = [];
            PhIssueTracker.getIssueTrackerList().then((issueTrackerList) => {
                $scope.issueTrackers = issueTrackerList;
            });

            $scope.update = function () {
                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                const selectedIssueTracker = $scope.modifyAlert.selectedIssueTracker.$modelValue;

                $scope.modifying = true;
                alertSummary.assignBug(newId, selectedIssueTracker.id).then(function () {
                    $scope.modifying = false;
                    $uibModalInstance.close('assigned');
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
    'EditAlertSummaryNotesCtrl', ['$scope', '$uibModalInstance', 'alertSummary',
        function ($scope, $uibModalInstance, alertSummary) {
            $scope.title = 'Edit notes';
            $scope.placeholder = 'Leave notes here...';
            $scope.error = false;
            $scope.alertSummaryCopy = angular.copy(alertSummary);

            $scope.saveChanges = function () {
                $scope.modifying = true;
                $scope.alertSummaryCopy.saveNotes().then(function () {
                    _.merge(alertSummary, $scope.alertSummaryCopy);
                    $scope.modifying = false;
                    $scope.error = false;

                    $uibModalInstance.close();
                }, function () {
                    $scope.error = true;
                    $scope.modifying = false;
                },
                );
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
    'MarkDownstreamAlertsCtrl', ['$scope', '$uibModalInstance', '$q', 'alertSummary',
        'allAlertSummaries',
        function ($scope, $uibModalInstance, $q, alertSummary, allAlertSummaries) {
            $scope.title = 'Mark alerts downstream';
            $scope.placeholder = 'Alert #';

            $scope.update = () => {
                const newId = parseInt(
                    $scope.modifyAlert.newId.$modelValue);

                alertSummary.modifySelectedAlerts({
                    status: phAlertStatusMap.DOWNSTREAM.id,
                    related_summary_id: newId,
                }).then(() => {
                        const summariesToUpdate = [alertSummary].concat(
                            _.find(allAlertSummaries, alertSummary =>
                                alertSummary.id === newId) || []);
                        $q.all(summariesToUpdate.map(alertSummary => alertSummary.update(),
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
                alertSummary.modifySelectedAlerts({
                    status: phAlertStatusMap.REASSIGNED.id,
                    related_summary_id: newId,
                }).then(function () {
                    // FIXME: duplication with downstream alerts controller
                    const summariesToUpdate = [alertSummary].concat(
                        _.find(allAlertSummaries, alertSummary =>
                          alertSummary.id === newId) || []);
                    $q.all(summariesToUpdate.map(alertSummary => alertSummary.update(),
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
    'ThRepositoryModel', 'ThResultSetModel',
    'PhFramework', 'PhAlerts', 'PhBugs', 'PhIssueTracker',
    'dateFilter', 'clipboard',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $q,
                        $uibModal,
                        ThRepositoryModel,
                        ThResultSetModel,
                        PhFramework, PhAlerts, PhBugs, PhIssueTracker,
                        dateFilter, clipboard) {
        $scope.alertSummaries = undefined;
        $scope.getMoreAlertSummariesHref = null;
        $scope.getCappedMagnitude = function (percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression === 100% bad)
            return Math.min(Math.abs(percent) * 5, 100);
        };

        $scope.editAlertSummaryNotes = function (alertSummary) {
            $uibModal.open({
                template: editAlertSummaryNotesCtrlTemplate,
                controller: 'EditAlertSummaryNotesCtrl',
                size: 'md',
                resolve: {
                    alertSummary: function () {
                        return alertSummary;
                    },
                },
            });
        };

        // can filter by alert statuses or just show everything
        $scope.statuses = Object.values(phAlertSummaryStatusMap);
        $scope.statuses = $scope.statuses.concat({ id: -1, text: 'all' });

        $scope.changeAlertSummaryStatus = function (alertSummary, open) {
            PhAlerts.changeAlertSummaryStatus(
                alertSummary.id, open).then(function () {
                    alertSummary.is_open = open;
                });
        };

        function updateAlertVisibility() {
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
            return alerts.map(alert => !alert.isUntriaged() && alert.selected).some(x => x);
        };
        $scope.allSelectedAreConfirming = function (alerts) {
            return alerts.filter(alert => alert.selected).map(alert => alert.isConfirming()).every(x => x);
        };
        $scope.selectNoneOrSelectAll = function (alertSummary) {
            // if some are not selected, then select all if checked
            // otherwise select none
            alertSummary.alerts.forEach(function (alert) {
                alert.selected = alert.visible && alertSummary.allSelected;
            });
        };
        $scope.alertSelected = function (alertSummary) {
            if (alertSummary.alerts.every(alert => !alert.visible || alert.selected)) {
                alertSummary.allSelected = true;
            } else {
                alertSummary.allSelected = false;
            }
        };

        $scope.copyTextToClipboard = function (alertSummary) {
            clipboard.copyText(alertSummary.getTextualSummary(true));
        };

        $scope.fileBug = function (alertSummary) {
            PhBugs.fileBug(alertSummary);
        };
        $scope.linkToBug = function (alertSummary) {
            $uibModal.open({
                template: modifyAlertsCtrlTemplate,
                controller: 'ModifyAlertSummaryCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function () {
                        return alertSummary;
                    },
                },
            }).result.then(function () {
                updateAlertVisibility();
            });
        };
        $scope.unlinkBug = function (alertSummary) {
            alertSummary.unassignBug().then(function () {
                updateAlertVisibility();
            });
        };
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
                updateAlertVisibility();
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
                updateAlertVisibility();
            });
        };

        function updateAlertSummary(alertSummary) {
            alertSummary.update().then(function () {
                updateAlertVisibility();
            });
        }
        $scope.markAlertsConfirming = function (alertSummary) {
            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.CONFIRMING.id,
            }).then(
                function () {
                    updateAlertSummary(alertSummary);
                });
        };
        $scope.markAlertsAcknowledged = function (alertSummary) {
            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.ACKNOWLEDGED.id,
            }).then(
                function () {
                    updateAlertSummary(alertSummary);
                });
        };
        $scope.markAlertsInvalid = function (alertSummary) {
            alertSummary.modifySelectedAlerts({
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
                alert => (_.find($scope.alertSummaries, alertSummary =>
                        alertSummary.id === alert.related_summary_id) || []),
                )).reduce((a, b) => [...a, ...b], []));

            alertSummary.modifySelectedAlerts({
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
                _.defaults(resultSetToSummaryMap,
                           _.set({}, alertSummary.repository, {}));

                alertSummary.originalNotes = alertSummary.notes;

                [alertSummary.push_id, alertSummary.prev_push_id].forEach(
                    function (resultSetId) {
                        // skip nulls
                        if (resultSetId === null) return;
                        const repoMap = resultSetToSummaryMap[alertSummary.repository];
                        // initialize map for this result set, if not already
                        // initialized
                        _.defaults(repoMap, _.set({}, resultSetId, []));
                        repoMap[resultSetId].push(alertSummary);
                    });
            });

            $q.all(Object.keys(resultSetToSummaryMap).map(repo =>
              ThResultSetModel.getResultSetList(
                    repo, Object.keys(resultSetToSummaryMap[repo]), true).then(
                        (response) => {
                            response.data.results.forEach((resultSet) => {
                                resultSet.dateStr = dateFilter(
                                    resultSet.push_timestamp * 1000, thDateFormat);
                                // want at least 14 days worth of results for relative comparisons
                                const timeRange = phTimeRangeValues[repo] ? phTimeRangeValues[repo] : phDefaultTimeRangeValue;
                                resultSet.timeRange = Math.max(timeRange, _.find(
                                    phTimeRanges.map(timeRange => timeRange.value),
                                    (t => ((Date.now() / 1000.0) - resultSet.push_timestamp) < t)));
                                resultSetToSummaryMap[repo][resultSet.id].forEach(
                                          (summary) => {
                                              if (summary.push_id === resultSet.id) {
                                                  summary.resultSetMetadata = resultSet;
                                              } else if (summary.prev_push_id === resultSet.id) {
                                                  summary.prevResultSetMetadata = resultSet;
                                              }
                                          });
                            });

                        }),
            )).then(() => {
                // for all complete summaries, fill in job and pushlog links
                // and downstream summaries
                alertSummaries.forEach((summary) => {
                    const repo = _.find($rootScope.repos,
                                      { name: summary.repository });

                    if (summary.prevResultSetMetadata &&
                        summary.resultSetMetadata) {
                        summary.jobsURL = getJobsUrl({
                            repo: summary.repository,
                            fromchange: summary.prevResultSetMetadata.revision,
                            tochange: summary.resultSetMetadata.revision });
                        summary.pushlogURL = repo.getPushLogHref({
                            from: summary.prevResultSetMetadata.revision,
                            to: summary.resultSetMetadata.revision,
                        });
                    }

                    summary.downstreamSummaryIds = [...new Set((
                      summary.alerts.map((alert) => {
                        if (alert.status === phAlertStatusMap.DOWNSTREAM.id &&
                            alert.summary_id !== summary.id) {
                          return alert.summary_id;
                        }
                        return [];
                      })).reduce((a, b) => [...a, ...b], []))];
                });

                // update master list + visibility
                if (_.isUndefined($scope.alertSummaries)) {
                    $scope.alertSummaries = alertSummaries;
                } else {
                    $scope.alertSummaries = _.union($scope.alertSummaries,
                                                    alertSummaries);
                }
                updateAlertVisibility();
            });
        }

        $scope.getMoreAlertSummaries = function () {
            PhAlerts.getAlertSummaries({ href: $scope.getMoreAlertSummariesHref }).then(
                function (data) {
                    addAlertSummaries(data.results, data.next);
                });
        };

        $scope.alertSummaryCount = 0;
        $scope.alertSummaryCurrentPage = 1;
        $scope.alertSummaryPageSize = 10;
        $scope.getAlertSummariesPage = function () {
            PhAlerts.getAlertSummaries({
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

        $scope.summaryTitle = {
            html: '<i class="fa fa-spinner fa-pulse" aria-hidden="true"/>',
            promise: null,
        };

        $scope.getSummaryTitle = function (id) {
            $scope.summaryTitle.promise = PhAlerts.getAlertSummaryTitle(id);
            $scope.summaryTitle.promise.then(
                function (summaryTitle) {
                    $scope.summaryTitle.html = '<p>' + summaryTitle + '</p>';
                });
        };

        $scope.resetSummaryTitle = function () {
            $scope.summaryTitle.promise.cancel();
            $scope.summaryTitle.html = '<i class="fa fa-spinner fa-pulse" aria-hidden="true"/>';
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
                PhAlerts.getAlertSummaries({
                    statusFilter: $scope.filterOptions.status.id,
                    frameworkFilter: $scope.filterOptions.framework.id,
                }).then(
                    function (data) {
                        addAlertSummaries(data.results, data.next);
                        $scope.alertSummaryCount = data.count;
                        $scope.alertSummaryCurrentPage = 1;
                    });
            } else {
                updateAlertVisibility();
            }
        };

        ThRepositoryModel.load().then(function () {
            $q.all([PhFramework.getFrameworkList().then(function (frameworks) {
                $scope.frameworks = frameworks;
            }), OptionCollectionModel.getMap().then(function (optionCollectionMap) {
                $scope.optionCollectionMap = optionCollectionMap;
            })]).then(function () {
                $scope.filterOptions = {
                    status: _.find($scope.statuses, {
                        id: parseInt($stateParams.status),
                    }) || $scope.statuses[0],
                    framework: _.find($scope.frameworks, {
                        id: parseInt($stateParams.framework),
                    }) || $scope.frameworks[0],
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
                    PhAlerts.getAlertSummary($stateParams.id).then(
                        function (data) {
                            addAlertSummaries([data], null);
                        });
                } else {
                    PhAlerts.getAlertSummaries({
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
