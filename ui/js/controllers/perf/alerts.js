"use strict";

perf.factory('PhAlerts', ['$http', 'thServiceDomain', function($http, thServiceDomain) {
    return {
        getAlertSummary: function(id) {
            // get a specific alert summary
            return $http.get(thServiceDomain +
                             '/api/performance/alertsummary/' + id + '/').then(
                                 function(response) {
                                     return response.data;
                                 });
        },
        getAlertSummaries: function(href) {
            // get a range of alert ids, offset is offset from latest (i.e. 0),
            // count is the number to get
            if (!href) {
                href = thServiceDomain + '/api/performance/alertsummary/';
            }
            return $http.get(href).then(function(response) {
                return response.data;
            });
        },
        changeAlertSummaryStatus: function(alertSummaryId, newStatus) {
            return $http.put(thServiceDomain +
                             '/api/performance/alertsummary/' + alertSummaryId + '/',
                             { status: newStatus });
        },
        modifyAlert: function(alertId, modification) {
            return $http.put(thServiceDomain +
                             '/api/performance/alert/' + alertId + '/',
                             modification);
        }
    };
}]);

perf.controller(
    'ModifyAlertsCtrl',
    function($scope, $modalInstance, $http, $q, alertSummary, PhAlerts,
             modifiedStatus, phAlertResolutionMap) {
        if (modifiedStatus === phAlertResolutionMap.DUPLICATE) {
            $scope.title = "Reassign to...";
            $scope.placeholder = "Alert #";
        } else { // bug number only other current possibility
            $scope.title = "Change bug number...";
            $scope.placeholder = "Bug #";
        }

        var alerts = _.where(alertSummary.alerts, {'selected': true});
        $scope.modifyAlerts = function() {
            var modification = {
                revised_summary_id: null,
                bug_number: null,
                status: modifiedStatus
            };
            var newId = parseInt(
                $scope.modifyAlert.newId.$modelValue);
            if (modifiedStatus === phAlertResolutionMap.DUPLICATE) {
                modification.revised_summary_id = newId;
            } else {
                modification.bug_number = newId;
            }
            $scope.modifying = true;
            $q.all(_.map(alerts, function(alert) {
                return PhAlerts.modifyAlert(alert.id, modification);
            })).then(function() {
                $scope.modifying = false;
                alertSummary.allSelected = false; // all are no longer selected
                alerts.forEach(function(alert) {
                    _.assign(alert, {selected:false}, modification);
                });
                $modalInstance.dismiss('modified');
            });
        };
        $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
        };
        $scope.$on('modal.closing', function(event, reason, closed) {
            if ($scope.modifying) {
                event.preventDefault();
            }
        });
    });

perf.controller('AlertsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$http', '$q', '$modal',
    'thUrl', 'ThRepositoryModel', 'ThOptionCollectionModel', 'ThResultSetModel',
    'PhFramework', 'PhSeries', 'PhAlerts', 'phTimeRanges',
    'phDefaultTimeRangeValue', 'phAlertResolutionMap', 'dateFilter',
    'thDateFormat',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        $modal, thUrl, ThRepositoryModel,
                        ThOptionCollectionModel, ThResultSetModel,
                        PhFramework, PhSeries, PhAlerts, phTimeRanges,
                        phDefaultTimeRangeValue, phAlertResolutionMap,
                        dateFilter, thDateFormat) {
        $scope.alertSummaries = [];
        $scope.getMoreAlertSummariesHref = null;
        $scope.getCappedMagnitude = function(percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression == 100% bad)
            return Math.min(Math.abs(percent)*5, 100);
        };
        $scope.phAlertResolutionMap = phAlertResolutionMap;

        $scope.changeAlertSummaryStatus = function(alertSummary, status) {
            PhAlerts.changeAlertSummaryStatus(
                alertSummary.id, status).then(function() {
                    alertSummary.status = status;
                });
        };

        function updateAlertVisibility() {
            _.forEach($scope.alertSummaries, function(alertSummary) {
                _.forEach(alertSummary.alerts, function(alert) {
                    // only show alert if it passes all filter criteria
                    alert.visible =
                        (alert.series_signature.framework_id === $scope.filterOptions.framework.id) &&
                        (!$scope.filterOptions.hideImprovements || alert.is_regression) &&
                        _.every($scope.filterOptions.filter.split(' '),
                                function(matchText) {
                                    return !matchText ||
                                        alert.title.toLowerCase().indexOf(
                                            matchText.toLowerCase()) > (-1);
                                });
                });
                alertSummary.anyVisible = _.any(alertSummary.alerts,
                                                'visible');
            });
            $scope.numFilteredAlertSummaries = _.filter($scope.alertSummaries, { anyVisible: false }).length;

        }

        $scope.filtersUpdated = function() {
            $state.transitionTo('alerts', {
                framework: $scope.filterOptions.framework.id,
                filter: $scope.filterOptions.filter,
                hideImprovements: Boolean($scope.filterOptions.hideImprovements) ? undefined : 0,
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });
            updateAlertVisibility();
        };

        // these methods handle the business logic of alert selection and
        // unselection
        $scope.anySelected = function(alerts) {
            return _.any(_.pluck(alerts, 'selected'));
        };
        $scope.anySelectedAndTriaged = function(alerts) {
            return _.any(alerts, function(alert) {
                return (alert.status !== phAlertResolutionMap.UNTRIAGED &&
                        alert.selected);
            });
        };
        $scope.selectNoneOrSelectAll = function(alertSummary) {
            // if some are not selected, then select all if checked
            // otherwise select none
            alertSummary.alerts.forEach(function(alert) {
                alert.selected = alertSummary.allSelected;
            });
        };
        $scope.alertSelected = function(alertSummary) {
            if (_.all(_.pluck(alertSummary.alerts, 'selected'))) {
                alertSummary.allSelected = true;
            } else {
                alertSummary.allSelected = false;
            }
        };

        $scope.fileBug = function(alertSummary) {
            window.open("https://edmorley.github.io/fileit/");
        };

        function modifyAlerts(alertSummary, modifiedStatus) {
            $modal.open({
                templateUrl: 'partials/perf/modifyalertsctrl.html',
                controller: 'ModifyAlertsCtrl',
                size: 'sm',
                resolve: {
                    modifiedStatus: function() {
                        return modifiedStatus;
                    },
                    alertSummary: function() {
                        return alertSummary;
                    }
                }
            });
        }
        $scope.reassignAlerts = function(alertSummary) {
            modifyAlerts(alertSummary, phAlertResolutionMap.DUPLICATE);
        };
        $scope.addBugNumberToAlerts = function(alertSummary) {
            modifyAlerts(alertSummary, phAlertResolutionMap.INVESTIGATING);
        };

        function modifySelectedAlertStatus(alertSummary, status) {
            alertSummary.allSelected = false;
            _.where(alertSummary.alerts, {'selected': true}).forEach(
                function(selectedAlert) {
                    var modification = {
                        status: status,
                        revised_summary_id: null,
                        bug_number: null
                    };
                    PhAlerts.modifyAlert(selectedAlert.id, modification).then(function() {
                        _.assign(selectedAlert, modification);
                        selectedAlert.selected = false;
                    });
                });
        }

        $scope.markAlertsInvalid = function(alertSummary) {
            modifySelectedAlertStatus(alertSummary,
                                      phAlertResolutionMap.INVALID);
        };

        $scope.resetAlerts = function(alertSummary) {
            modifySelectedAlertStatus(alertSummary,
                                      phAlertResolutionMap.UNTRIAGED);
        };
        function addAlertSummaries(alertSummaries, getMoreAlertSummariesHref) {
            $scope.getMoreAlertSummariesHref = getMoreAlertSummariesHref;

            // create a mapping of result set information -> alert summaries,
            // so we can fill in revision information for each alert summary
            // (this is sadly easier to do on the client side than the server
            // right now, because all the result set information is in a
            // different database than the perf data)
            var resultSetToSummaryMap = {};
            alertSummaries.forEach(function(alertSummary) {
                // initialize summary map for this repository, if not already
                // initialized
                _.defaults(resultSetToSummaryMap,
                           _.set({}, alertSummary.repository, {}));

                _.forEach(
                    [alertSummary.result_set_id, alertSummary.prev_result_set_id],
                    function(resultSetId) {
                        var repoMap = resultSetToSummaryMap[alertSummary.repository];
                        // initialize map for this result set, if not already
                        // initialized
                        _.defaults(repoMap, _.set({}, resultSetId, []));
                        repoMap[resultSetId].push(alertSummary);
                    });

                alertSummary.alerts.forEach(function(alert) {
                    alert.title = PhSeries.getSeriesName(
                        alert.series_signature, $scope.optionCollectionMap,
                        {includePlatformInName: true});
                });

                alertSummary.title = alertSummary.repository;
                if (alertSummary.alerts.length > 1) {
                    alertSummary.title += " " +
                        _.min(_.pluck(alertSummary.alerts, 'amount_pct')) + " - " +
                        _.max(_.pluck(alertSummary.alerts, 'amount_pct')) + "%";
                } else {
                    alertSummary.title += " " + alertSummary.alerts[0].amount_pct + "%";
                }
                alertSummary.title += " " + _.uniq(
                    _.map(alertSummary.alerts, function(a) {
                        return PhSeries.getTestName(a, { abbreviate:true });
                    })).sort().join(' / ');
                alertSummary.platforms = _.uniq(_.pluck(alertSummary.alerts,
                                                        'machine_platform')).sort();
            });

            $q.all(_.map(_.keys(resultSetToSummaryMap), function(repo) {
                return ThResultSetModel.getResultSetList(
                    repo, _.keys(resultSetToSummaryMap[repo]), true).then(
                        function(response) {
                            response.data.results.forEach(function(resultSet) {
                                resultSet.dateStr = dateFilter(
                                    resultSet.push_timestamp*1000, thDateFormat);
                                // want at least 14 days worth of results for relative comparisons
                                resultSet.timeRange = Math.max(phDefaultTimeRangeValue, _.find(
                                    _.pluck(phTimeRanges, 'value'),
                                    function(t) {
                                        return ((Date.now() / 1000.0) - resultSet.push_timestamp) < t;
                                    }));
                                _.forEach(resultSetToSummaryMap[repo][resultSet.id],
                                          function(summary) {
                                              if (summary.result_set_id === resultSet.id) {
                                                  summary.resultSetMetadata = resultSet;
                                              } else if (summary.prev_result_set_id == resultSet.id) {
                                                  summary.prevResultSetMetadata = resultSet;
                                              }
                                          });
                            });

                        });
            })).then(function() {
                // for all complete summaries, fill in job and pushlog links
                _.forEach(alertSummaries, function(summary) {
                    var repo =  _.findWhere($rootScope.repos,
                                            { name: summary.repository });

                    if (summary.prevResultSetMetadata &&
                        summary.resultSetMetadata) {
                        summary.jobsURL = thUrl.getJobsUrl(
                            summary.repository,
                            summary.prevResultSetMetadata.revision,
                            summary.resultSetMetadata.revision);
                        summary.pushlogURL = repo.getPushLogHref({
                            from: summary.prevResultSetMetadata.revision,
                            to: summary.resultSetMetadata.revision
                        });
                    }
                });

                // update master list + visibility
                $scope.alertSummaries = _.union($scope.alertSummaries,
                                                alertSummaries);
                updateAlertVisibility();
            });
        }

        $scope.getMoreAlertSummaries = function(count) {
            PhAlerts.getAlertSummaries($scope.getMoreAlertSummariesHref).then(
                function(data) {
                    addAlertSummaries(data.results, data.next);
                });
        };

        ThRepositoryModel.load().then(function(response) {
            $q.all([PhFramework.getFrameworkList().then(
                function(frameworks) {
                    $scope.frameworks = frameworks.data;
                }),
                    ThOptionCollectionModel.get_map().then(
                        function(optionCollectionMap) {
                            $scope.optionCollectionMap = optionCollectionMap;
                        })]
                  ).then(function() {
                      $scope.filterOptions = {
                          framework: _.find($scope.frameworks, {
                              id: parseInt($stateParams.framework)
                          }) || $scope.frameworks[0],
                          filter: $stateParams.filter || "",
                          hideImprovements: $stateParams.hideImprovements === undefined ||
                              parseInt($stateParams.hideImprovements)
                      };
                      if ($stateParams.id) {
                          PhAlerts.getAlertSummary($stateParams.id).then(
                              function(data) {
                                  addAlertSummaries([data], null);
                              });
                      } else {
                          PhAlerts.getAlertSummaries().then(function(data) {
                              addAlertSummaries(data.results, data.next);
                          });
                      }
                  });
        });
    }
]);
