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
    '$templateRequest', '$interpolate',
    'thUrl', 'ThRepositoryModel', 'ThOptionCollectionModel',
    'ThResultSetModel',
    'PhFramework', 'PhSeries', 'PhAlerts', 'phTimeRanges',
    'phDefaultTimeRangeValue', 'phAlertResolutionMap', 'phTalosDocumentationMap',
    'phTrySyntaxBuildPlatformMap', 'phTrySyntaxTalosModifierMap',
    'mcTalosConfigUrl', 'dateFilter', 'thDateFormat',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        $modal, $templateRequest, $interpolate,
                        thUrl, ThRepositoryModel,
                        ThOptionCollectionModel, ThResultSetModel,
                        PhFramework, PhSeries, PhAlerts, phTimeRanges,
                        phDefaultTimeRangeValue, phAlertResolutionMap,
                        phTalosDocumentationMap,
                        phTrySyntaxBuildPlatformMap, phTrySyntaxTalosModifierMap,
                        mcTalosConfigUrl,
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

        function getAlertTitle(alerts) {
            var title;
            if (alerts.length > 1) {
                title = _.min(_.pluck(alerts, 'amount_pct')) + " - " +
                    _.max(_.pluck(alerts, 'amount_pct')) + "%";
            } else {
                title = alerts[0].amount_pct + "%";
            }
            // add test info
            title += " " + _.uniq(
                _.map(alerts, function(a) {
                    return PhSeries.getTestName(a.series_signature, { abbreviate:true });
                })).sort().join(' / ');
            // add platform info
            title += " (" + _.uniq(
                _.map(alerts, function(a) {
                    return a.series_signature.machine_platform;
                })).sort().join(', ') + ')';

            return title;
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
            $http.get(mcTalosConfigUrl).then(function(response) {
                // yes this is ridiculous, but it's (hopefully) less likely
                // to break than the alternatives, since it should auto-update
                // whenever someone changes the talos configuration in
                // mozilla-central
                var trySuiteMapping = {};
                _.forEach(
                    _.filter(Object.keys(response.data.suites),
                             function(buildbotSuite) {
                                 // we only want the high level suite names, -
                                 // and _ denote variants
                                 return (buildbotSuite.indexOf('-') === -1 &&
                                         buildbotSuite.indexOf('_') === -1);
                             }),
                    function(buildbotSuite) {
                        _.forEach(
                            response.data.suites[buildbotSuite].tests, function(test) {
                                trySuiteMapping[test] = buildbotSuite;
                            });
                    });
                $templateRequest('partials/perf/bugzilla_talos.tmpl').then(
                    function(template) {
                        var selectedAlerts = _.filter(alertSummary.alerts,
                                                      {selected: true});
                        var testDescriptions = _.uniq(_.map(selectedAlerts, function(alert) {
                            var suitekey = alert.series_signature.suite;
                            var testkey = alert.series_signature.suite + '_' +
                                alert.series_signature.test;
                            var prefix = 'https://wiki.mozilla.org/Buildbot/Talos/Tests#';
                            if (phTalosDocumentationMap[suitekey]) {
                                return prefix + phTalosDocumentationMap[suitekey];
                            } else if (phTalosDocumentationMap[testkey]) {
                                return prefix + phTalosDocumentationMap[testkey];
                            } else {
                                // assume suitekey or testkey will work otherwise
                                if (alert.series_signature.test) {
                                    return prefix + testkey;
                                }
                                return prefix + suitekey;
                            }
                        }));
                        var talosSuites = _.uniq(_.map(selectedAlerts, function(alert) {
                            return alert.series_signature.suite;
                        }));
                        var tryBuildPlatforms = _.uniq(_.map(selectedAlerts, function(alert) {
                            var platform =  alert.series_signature.machine_platform;
                            var mappedPlatform = phTrySyntaxBuildPlatformMap[platform];
                            if (mappedPlatform)
                                return mappedPlatform;
                            return platform;
                        }));
                        var tryTalosModifiers = _.uniq(_.filter(_.map(
                            selectedAlerts, function(alert) {
                                var platform =  alert.series_signature.machine_platform;
                                var mappedPlatform = phTrySyntaxTalosModifierMap[platform];
                                if (mappedPlatform)
                                    return mappedPlatform;
                                return undefined;
                            })));
                        if (tryTalosModifiers.length) {
                            tryTalosModifiers = '[' + tryTalosModifiers.join(',') + ']';
                        } else {
                            tryTalosModifiers = "";
                        }
                        var trySuites = _.uniq(_.map(selectedAlerts, function(alert) {
                            var suiteName = trySuiteMapping[alert.series_signature.suite];
                            if (_.contains(alert.series_signature.test_options, 'e10s')) {
                                suiteName += '-e10s';
                            }
                            return suiteName + tryTalosModifiers;
                        }));
                        // they have 3 days from today to respond (if backout day
                        // would be a Saturday or Sunday, delay until the following
                        // Monday)
                        var backoutDate = new Date(Date.now() + 3*86400*1000);
                        if (backoutDate.getDay() === 6) {
                            backoutDate.setDate(backoutDate.getDate() + 2);
                        } else if (backoutDate.getDay() === 0) {
                            backoutDate.setDate(backoutDate.getDate() + 1);
                        }
                        var dayMapping = {
                            0: 'Sunday', // not used
                            1: 'Monday',
                            2: 'Tuesday',
                            3: 'Wednesday',
                            4: 'Thursday',
                            5: 'Friday',
                            6: 'Saturday' // not used
                        };
                        var compiled = $interpolate(template)({
                            revision: alertSummary.resultSetMetadata.revision,
                            alertHref: window.location.origin + '/perf.html#/alerts?id=' +
                                alertSummary.id,
                            testDescriptions: testDescriptions.join('\n'),
                            tryBuildPlatforms: tryBuildPlatforms.join(','),
                            trySuites: trySuites.join(','),
                            talosTestListSyntax: talosSuites.join(":"),
                            backoutDay: dayMapping[backoutDate.getDay()]
                        });
                        var pushDate = dateFilter(
                            alertSummary.resultSetMetadata.push_timestamp*1000,
                            "EEE MMM d yyyy");
                        var bugTitle = getAlertTitle(selectedAlerts) +
                            " regression on push " +
                            alertSummary.resultSetMetadata.revision + " (" +
                            pushDate + ")";
                        window.open("https://bugzilla.mozilla.org/enter_bug.cgi?component=Untriaged&product=Firefox&short_desc=" + encodeURIComponent(bugTitle) + "&comment=" + encodeURIComponent(compiled) + '&keywords=perf%2C%20regression%2C%20&status_whiteboard=%5Btalos_regression%5D');
                    });
            });
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

                alertSummary.title = alertSummary.repository + " " +
                    getAlertTitle(alertSummary.alerts);
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
