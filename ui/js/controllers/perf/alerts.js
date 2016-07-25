"use strict";

perf.factory('PhBugs', [
    '$http', '$httpParamSerializer', '$templateRequest', '$interpolate', 'dateFilter', 'thServiceDomain', 'phAlertStatusMap', 'mcTalosConfigUrl',
    'phTalosDocumentationMap', 'phTrySyntaxBuildPlatformMap', 'phTrySyntaxTalosModifierMap',
    function($http, $httpParamSerializer, $templateRequest, $interpolate, dateFilter, thServiceDomain, phAlertStatusMap, mcTalosConfigUrl,
             phTalosDocumentationMap, phTrySyntaxBuildPlatformMap, phTrySyntaxTalosModifierMap) {
        return {
            fileTalosBug: function(alertSummary) {
                $http.get(thServiceDomain + '/api/performance/bug-template/?framework=' + alertSummary.framework).then(function(response) {
                    var validAlerts = _.filter(alertSummary.alerts, function(alert) {
                        return alert.status !== phAlertStatusMap.INVALID;
                    });
                    var template = response.data[0];
                    var compiledText = $interpolate(template.text)({
                        revision: alertSummary.resultSetMetadata.revision,
                        alertHref: window.location.origin + '/perf.html#/alerts?id=' +
                            alertSummary.id,
                        alertSummary: alertSummary.getTextualSummary()
                    });
                    var pushDate = dateFilter(
                        alertSummary.resultSetMetadata.push_timestamp*1000,
                        "EEE MMM d yyyy");
                    var bugTitle = alertSummary.getTitle() +
                        " regression on push " +
                        alertSummary.resultSetMetadata.revision + " (" +
                        pushDate + ")";
                    window.open(
                        "https://bugzilla.mozilla.org/enter_bug.cgi?" + $httpParamSerializer({
                            cc: template.cc_list,
                            comment: compiledText,
                            component: template.default_component,
                            product: template.default_product,
                            keywords: template.keywords,
                            short_desc: bugTitle,
                            status_whiteboard: template.status_whiteboard
                        }));
                });
            }
        };
    }]);

perf.controller(
    'ModifyAlertSummaryCtrl',
    function($scope, $uibModalInstance, alertSummary) {
        $scope.title = "Link to bug";
        $scope.placeholder = "Bug #";

        $scope.update = function() {
            var newId = parseInt(
                $scope.modifyAlert.newId.$modelValue);

            $scope.modifying = true;
            alertSummary.assignBug(newId).then(function() {
                $scope.modifying = false;
                $uibModalInstance.close('assigned');
            });
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
        $scope.$on('modal.closing', function(event, reason, closed) {
            if ($scope.modifying) {
                event.preventDefault();
            }
        });
    });

perf.controller(
    'MarkDownstreamAlertsCtrl',
    function($scope, $uibModalInstance, $http, $q, alertSummary, allAlertSummaries,
             PhAlerts, phAlertStatusMap) {
        $scope.title = "Mark alerts downstream";
        $scope.placeholder = "Alert #";

        var alerts = _.where(alertSummary.alerts, {'selected': true});
        $scope.update = function() {
            var newId = parseInt(
                $scope.modifyAlert.newId.$modelValue);

            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.DOWNSTREAM.id,
                related_summary_id: newId
            }).then(
                function() {
                    var summariesToUpdate = [alertSummary].concat(
                        _.find(allAlertSummaries, function(alertSummary) {
                            return alertSummary.id === newId;
                        }) || []);
                    $q.all(_.map(summariesToUpdate, function(alertSummary) {
                        return alertSummary.update();
                    })).then(function() {
                        $uibModalInstance.close('downstreamed');
                    });
                });
        };
        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
        $scope.$on('modal.closing', function(event, reason, closed) {
            if ($scope.modifying) {
                event.preventDefault();
            }
        });
    });

perf.controller(
    'ReassignAlertsCtrl',
    function($scope, $uibModalInstance, $http, $q, alertSummary,
             allAlertSummaries, PhAlerts, phAlertStatusMap) {

        $scope.title = "Reassign alerts";
        $scope.placeholder = "Alert #";

        var alerts = _.where(alertSummary.alerts, {'selected': true});
        $scope.update = function() {

            var newId = parseInt(
                $scope.modifyAlert.newId.$modelValue);

            // FIXME: validate that new summary id is on same repository?
            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.REASSIGNED.id,
                related_summary_id: newId
            }).then(function() {
                // FIXME: duplication with downstream alerts controller
                var summariesToUpdate = [alertSummary].concat(
                    _.find(allAlertSummaries, function(alertSummary) {
                        return alertSummary.id === newId;
                    }) || []);
                $q.all(_.map(summariesToUpdate, function(alertSummary) {
                    return alertSummary.update();
                })).then(function() {
                    $uibModalInstance.close('downstreamed');
                });
            });
        };
        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
        $scope.$on('modal.closing', function(event, reason, closed) {
            if ($scope.modifying) {
                event.preventDefault();
            }
        });
    });

perf.controller('AlertsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$http', '$q', '$uibModal',
    'thUrl', 'ThRepositoryModel', 'ThOptionCollectionModel',
    'ThResultSetModel',
    'PhFramework', 'PhSeries', 'PhAlerts', 'PhBugs', 'phTimeRanges',
    'phDefaultTimeRangeValue', 'phAlertSummaryStatusMap', 'phAlertStatusMap',
    'dateFilter', 'thDateFormat', 'clipboard',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        $uibModal,
                        thUrl, ThRepositoryModel,
                        ThOptionCollectionModel, ThResultSetModel,
                        PhFramework, PhSeries, PhAlerts, PhBugs, phTimeRanges,
                        phDefaultTimeRangeValue, phAlertSummaryStatusMap, phAlertStatusMap,
                        dateFilter, thDateFormat, clipboard) {
        $scope.alertSummaries = undefined;
        $scope.getMoreAlertSummariesHref = null;
        $scope.getCappedMagnitude = function(percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression === 100% bad)
            return Math.min(Math.abs(percent)*5, 100);
        };

        // can filter by alert statuses or just show everything
        $scope.statuses = _.map(phAlertSummaryStatusMap);
        $scope.statuses = $scope.statuses.concat({id: -1, text: "all"});

        $scope.changeAlertSummaryStatus = function(alertSummary, open) {
            PhAlerts.changeAlertSummaryStatus(
                alertSummary.id, open).then(function() {
                    alertSummary.is_open = open;
                });
        };

        function updateAlertVisibility() {
            _.forEach($scope.alertSummaries, function(alertSummary) {
                _.forEach(alertSummary.alerts, function(alert) {
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
                        _.every($scope.filterOptions.filter.split(' '),
                            function(matchText) {
                                return !matchText ||
                                    alert.title.toLowerCase().indexOf(
                                        matchText.toLowerCase()) > (-1);
                            });
                    // reset alert's selected status if it is no longer visible
                    alert.selected = alert.selected && alert.visible;
                });
                alertSummary.anyVisible = _.any(alertSummary.alerts,
                                                'visible');

                // if all are selected with this alert summary, update which
                // ones are selected
                if (alertSummary.allSelected) {
                    $scope.selectNoneOrSelectAll(alertSummary);
                }
            });
            $scope.numFilteredAlertSummaries = _.filter($scope.alertSummaries, { anyVisible: false }).length;

        }

        $scope.filtersUpdated = function() {
            var statusFilterChanged = (parseInt($state.params.status) !==
                                       $scope.filterOptions.status.id);
            var frameworkFilterChanged = (parseInt($state.params.framework) !==
                                          $scope.filterOptions.framework.id);

            $state.transitionTo('alerts', {
                status: $scope.alertId ? undefined : $scope.filterOptions.status.id,
                framework: $scope.alertId ? undefined : $scope.filterOptions.framework.id,
                filter: $scope.filterOptions.filter,
                hideImprovements: Boolean($scope.filterOptions.hideImprovements) ? 1 : undefined,
                page: 1
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });

            if (!$scope.alertId && (statusFilterChanged || frameworkFilterChanged)) {
                // if the status or framework filter changed (and we're not looking
                // at an individual summary), we should reload everything
                $scope.alertSummaries = undefined;
                PhAlerts.getAlertSummaries({
                    statusFilter: $scope.filterOptions.status.id,
                    frameworkFilter: $scope.filterOptions.framework.id
                }).then(
                    function(data) {
                        addAlertSummaries(data.results, data.next);
                        $scope.alertSummaryCount = data.count;
                        $scope.alertSummaryCurrentPage = 1;
                    });
            } else {
                updateAlertVisibility();
            }
        };

        // these methods handle the business logic of alert selection and
        // unselection
        $scope.anySelected = function(alerts) {
            return _.any(_.pluck(alerts, 'selected'));
        };
        $scope.anySelectedAndTriaged = function(alerts) {
            return _.any(alerts, function(alert) {
                return (!alert.isUntriaged() && alert.selected);
            });
        };
        $scope.selectNoneOrSelectAll = function(alertSummary) {
            // if some are not selected, then select all if checked
            // otherwise select none
            alertSummary.alerts.forEach(function(alert) {
                alert.selected = alert.visible && alertSummary.allSelected;
            });
        };
        $scope.alertSelected = function(alertSummary) {
            if (_.all(alertSummary.alerts, function(alert) {
                return !alert.visible || alert.selected;
            })) {
                alertSummary.allSelected = true;
            } else {
                alertSummary.allSelected = false;
            }
        };

        $scope.copyTextToClipboard = function(alertSummary) {
            clipboard.copyText(alertSummary.getTextualSummary());
        };

        $scope.fileBug = function(alertSummary) {
            PhBugs.fileTalosBug(alertSummary);
        };
        $scope.linkToBug = function(alertSummary) {
            $uibModal.open({
                templateUrl: 'partials/perf/modifyalertsctrl.html',
                controller: 'ModifyAlertSummaryCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function() {
                        return alertSummary;
                    }
                }
            }).result.then(function() {
                updateAlertVisibility();
            });
        };
        $scope.unlinkBug = function(alertSummary) {
            alertSummary.assignBug(null).then(function() {
                updateAlertVisibility();
            });
        };
        $scope.markAlertsDownstream = function(alertSummary) {
            $uibModal.open({
                templateUrl: 'partials/perf/modifyalertsctrl.html',
                controller: 'MarkDownstreamAlertsCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function() {
                        return alertSummary;
                    },
                    allAlertSummaries: function() {
                        return $scope.alertSummaries;
                    }
                }
            }).result.then(function() {
                updateAlertVisibility();
            });
        };
        $scope.reassignAlerts = function(alertSummary) {
            $uibModal.open({
                templateUrl: 'partials/perf/modifyalertsctrl.html',
                controller: 'ReassignAlertsCtrl',
                size: 'sm',
                resolve: {
                    alertSummary: function() {
                        return alertSummary;
                    },
                    allAlertSummaries: function() {
                        return $scope.alertSummaries;
                    }
                }
            }).result.then(function() {
                updateAlertVisibility();
            });
        };

        function updateAlertSummary(alertSummary) {
            alertSummary.update().then(function() {
                updateAlertVisibility();
            });
        }
        $scope.markAlertsAcknowledged = function(alertSummary) {
            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.ACKNOWLEDGED.id
            }).then(
                function() {
                    updateAlertSummary(alertSummary);
                });
        };
        $scope.markAlertsInvalid = function(alertSummary) {
            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.INVALID.id
            }).then(
                function() {
                    updateAlertSummary(alertSummary);
                });
        };

        $scope.resetAlerts = function(alertSummary) {
            // We need to update not only the summary when resetting the alert,
            // but other summaries affected by the change
            var summariesToUpdate = [alertSummary].concat(_.flatten(_.map(
                _.where(alertSummary.alerts, {'selected': true}),
                function(alert) {
                    return _.find($scope.alertSummaries, function(alertSummary) {
                        return alertSummary.id === alert.related_summary_id;
                    }) || [];
                })));

            alertSummary.modifySelectedAlerts({
                status: phAlertStatusMap.UNTRIAGED.id,
                related_summary_id: null
            }).then(
                function() {
                    // update the alert summaries appropriately
                    _.forEach(summariesToUpdate, function(alertSummary) {
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
                                              } else if (summary.prev_result_set_id === resultSet.id) {
                                                  summary.prevResultSetMetadata = resultSet;
                                              }
                                          });
                            });

                        });
            })).then(function() {
                // for all complete summaries, fill in job and pushlog links
                // and downstream summaries
                _.forEach(alertSummaries, function(summary) {
                    var repo = _.findWhere($rootScope.repos,
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

                    summary.downstreamSummaryIds = _.uniq(_.flatten(_.map(
                        summary.alerts, function(alert) {
                            if (alert.status === phAlertStatusMap.DOWNSTREAM.id &&
                                alert.summary_id !== summary.id) {
                                return alert.summary_id;
                            } else {
                                return [];
                            }
                        })));

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

        $scope.getMoreAlertSummaries = function(count) {
            PhAlerts.getAlertSummaries({ href: $scope.getMoreAlertSummariesHref }).then(
                function(data) {
                    addAlertSummaries(data.results, data.next);
                });
        };

        $scope.alertSummaryCount = 0;
        $scope.alertSummaryCurrentPage = 1;
        $scope.alertSummaryPageSize = 10;
        $scope.getAlertSummariesPage = function() {
            PhAlerts.getAlertSummaries({ page: $scope.alertSummaryCurrentPage,
                                         statusFilter: $scope.filterOptions.status.id,
                                         frameworkFilter: $scope.filterOptions.framework.id }).then(
                 function(data) {
                     $scope.alertSummaries = undefined;
                     addAlertSummaries(data.results, data.next);
                     $scope.alertSummaryCount = data.count;
                     $state.go('.', {page: $scope.alertSummaryCurrentPage}, {notify: false});
                 });
        };

        $scope.summaryTitle = {
            html: '<i class="fa fa-spinner fa-pulse" aria-hidden="true"/>',
            promise: null
        };

        $scope.getSummaryTitle = function(id) {
            $scope.summaryTitle.promise = PhAlerts.getAlertSummaryTitle(id);
            $scope.summaryTitle.promise.then(
                function(summaryTitle) {
                    $scope.summaryTitle.html = '<p>' + summaryTitle + '</p>';
                });
        };

        $scope.resetSummaryTitle = function() {
            $scope.summaryTitle.promise.cancel();
            $scope.summaryTitle.html = '<i class="fa fa-spinner fa-pulse" aria-hidden="true"/>';
        };

        ThRepositoryModel.load().then(function(response) {
            $q.all([PhFramework.getFrameworkList().then(
                function(frameworks) {
                    $scope.frameworks = frameworks;
                }),
                    ThOptionCollectionModel.getMap().then(
                        function(optionCollectionMap) {
                            $scope.optionCollectionMap = optionCollectionMap;
                        })]
                  ).then(function() {
                      $scope.filterOptions = {
                          status: _.find($scope.statuses, {
                              id: parseInt($stateParams.status)
                          }) || $scope.statuses[0],
                          framework: _.find($scope.frameworks, {
                              id: parseInt($stateParams.framework)
                          }) || $scope.frameworks[0],
                          filter: $stateParams.filter || "",
                          hideImprovements: $stateParams.hideImprovements !== undefined &&
                              parseInt($stateParams.hideImprovements),
                          page: $stateParams.page || 1
                      };
                      if ($stateParams.id) {
                          $scope.alertId = $stateParams.id;
                          PhAlerts.getAlertSummary($stateParams.id).then(
                              function(data) {
                                  addAlertSummaries([data], null);
                              });
                      } else {
                          PhAlerts.getAlertSummaries({
                              statusFilter: $scope.filterOptions.status.id,
                              frameworkFilter: $scope.filterOptions.framework.id,
                              page: $scope.filterOptions.page
                          }).then(
                              function(data) {
                                  addAlertSummaries(data.results, data.next);
                                  $scope.alertSummaryCurrentPage = $scope.filterOptions.page;
                                  $scope.alertSummaryCount = data.count;
                              });
                      }
                  });
        });
    }
]);
