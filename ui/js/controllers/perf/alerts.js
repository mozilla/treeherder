"use strict";

perf.factory('PhBugs', [
    '$http', '$templateRequest', '$interpolate', 'dateFilter', 'thServiceDomain', 'phAlertStatusMap', 'mcTalosConfigUrl',
    'phTalosDocumentationMap', 'phTrySyntaxBuildPlatformMap', 'phTrySyntaxTalosModifierMap',
    function($http, $templateRequest, $interpolate, dateFilter, thServiceDomain, phAlertStatusMap, mcTalosConfigUrl,
             phTalosDocumentationMap, phTrySyntaxBuildPlatformMap, phTrySyntaxTalosModifierMap) {
        return {
            fileTalosBug: function(alertSummary) {
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
                            var validAlerts = _.filter(alertSummary.alerts, function(alert) {
                                return alert.status !== phAlertStatusMap.INVALID;
                            });
                            var testDescriptions = _.uniq(_.map(validAlerts, function(alert) {
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
                            var talosSuites = _.uniq(_.map(validAlerts, function(alert) {
                                return alert.series_signature.suite;
                            }));
                            var tryBuildPlatforms = _.uniq(_.map(validAlerts, function(alert) {
                                var platform =  alert.series_signature.machine_platform;
                                var mappedPlatform = phTrySyntaxBuildPlatformMap[platform];
                                if (mappedPlatform)
                                    return mappedPlatform;
                                return platform;
                            }));
                            var tryTalosModifiers = _.uniq(_.filter(_.map(
                                validAlerts, function(alert) {
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
                            var trySuites = _.uniq(_.map(validAlerts, function(alert) {
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
                            var bugTitle = alertSummary.getTitle() +
                                " regression on push " +
                                alertSummary.resultSetMetadata.revision + " (" +
                                pushDate + ")";
                            window.open("https://bugzilla.mozilla.org/enter_bug.cgi?component=Untriaged&product=Firefox&short_desc=" + encodeURIComponent(bugTitle) + "&comment=" + encodeURIComponent(compiled) + '&keywords=perf%2C%20regression%2C%20&status_whiteboard=%5Btalos_regression%5D');
                        });
                });

            }
        };
    }]);

perf.factory('PhAlerts', [
    '$http', '$q', 'thServiceDomain', 'ThOptionCollectionModel', 'PhSeries',
    'phAlertSummaryStatusMap', 'phAlertStatusMap',
    function($http, $q, thServiceDomain, ThOptionCollectionModel, PhSeries,
             phAlertSummaryStatusMap, phAlertStatusMap) {

        var Alert = function(alertData, optionCollectionMap) {
            _.assign(this, alertData);
            this.title = PhSeries.getSeriesName(
                this.series_signature, optionCollectionMap,
                {includePlatformInName: true});
        };
        Alert.prototype.getStatusText = function() {
            return _.result(_.find(phAlertStatusMap, {id: this.status}),
                            'text');
        };
        Alert.prototype.modify = function(modification) {
            return $http.put(thServiceDomain +
                             '/api/performance/alert/' + this.id + '/',
                             modification);
        };
        _.forEach(phAlertStatusMap, function(status) {
            Alert.prototype['is' + _.capitalize(status.text)] = function() {
                return this.status === status.id;
            };
        });

        var AlertSummary = function(alertSummaryData, optionCollectionMap) {
            _.assign(this, alertSummaryData);
            this._initializeAlerts(optionCollectionMap);
        };
        _.forEach(phAlertSummaryStatusMap, function(status) {
            AlertSummary.prototype['is' + _.capitalize(status.text)] = function() {
                return this.status === status.id;
            };
        });
        AlertSummary.prototype._initializeAlerts = function(optionCollectionMap) {
            // this function converts the representation returned by the perfherder
            // api into a representation more suited for display in the UI

            // just treat related (reassigned or downstream) alerts as one
            // big block -- we'll display in the UI depending on their content
            this.alerts = _.map(this.alerts.concat(this.related_alerts),
                function(alertData) {
                    return new Alert(alertData, optionCollectionMap);
                });
        };
        AlertSummary.prototype.updateStatus = function(newStatus) {
            var alertSummary = this;
            return $http.put(thServiceDomain +
                             '/api/performance/alertsummary/' + this.id + '/',
                             { status: newStatus.id }).then(function() {
                                 alertSummary.status = newStatus.id;
                             });
        };
        AlertSummary.prototype.update = function() {
            var alertSummary = this;
            return $http.get(thServiceDomain +
                             '/api/performance/alertsummary/' + this.id + '/').then(
                                 function(response) {
                                     return ThOptionCollectionModel.getMap().then(
                                         function(optionCollectionMap) {
                                             _.assign(alertSummary, response.data);
                                             alertSummary._initializeAlerts(
                                                 optionCollectionMap);
                                         });
                                 });
        };
        AlertSummary.prototype.getTitle = function(options) {
            var title;
            if (this.alerts.length > 1) {
                title = _.min(_.pluck(this.alerts, 'amount_pct')) + " - " +
                    _.max(_.pluck(this.alerts, 'amount_pct')) + "%";
            } else if (this.alerts.length === 1) {
                title = this.alerts[0].amount_pct + "%";
            } else {
                title = "Empty alert";
            }
            // add test info
            title += " " + _.uniq(
                _.map(this.alerts, function(a) {
                    return PhSeries.getTestName(a.series_signature, { abbreviate:true });
                })).sort().join(' / ');
            // add platform info
            title += " (" + _.uniq(
                _.map(this.alerts, function(a) {
                    return a.series_signature.machine_platform;
                })).sort().join(', ') + ')';
            return title;
        };
        AlertSummary.prototype.assignBug = function(bugNumber) {
            var alertSummary = this;
            return $http.put(thServiceDomain +
                             '/api/performance/alertsummary/' + this.id + '/',
                             { bug_number: bugNumber }).then(function() {
                                 return alertSummary.update();
                             });
        };
        AlertSummary.prototype.modifySelectedAlerts = function(modification) {
            this.allSelected = false;

            return $q.all(_.where(this.alerts, {'selected': true}).map(
                function(selectedAlert) {
                    return selectedAlert.modify(modification).then(function() {
                        selectedAlert.selected = false;
                    });
                }));
        };
        AlertSummary.prototype.getStatusText = function() {
            return _.find(phAlertSummaryStatusMap, { id: this.status }).text;
        };

        return {
            getAlertSummary: function(id) {
                // get a specific alert summary
                return ThOptionCollectionModel.getMap().then(
                    function(optionCollectionMap) {
                        return $http.get(
                            thServiceDomain +
                                '/api/performance/alertsummary/' + id + '/').then(
                                    function(response) {
                                        return new AlertSummary(response.data,
                                                                optionCollectionMap);
                                    });
                    });
            },
            getAlertSummaries: function(options) {
                var href;
                if (!options || !options.href) {
                    href = thServiceDomain + '/api/performance/alertsummary/';

                    // add filter parameters for status and framework
                    var params = [];
                    if (options && !_.isUndefined(options.statusFilter) &&
                        options.statusFilter !== (-1)) {
                        params[params.length] = ("status=" + options.statusFilter);
                    }
                    if (options && !_.isUndefined(options.frameworkFilter)) {
                        params[params.length] = ("framework=" + options.frameworkFilter);
                    }

                    if (params.length) {
                        href += "?" + params.join("&");
                    }
                } else {
                    href = options.href;
                    // status filter already in url if using pregenerated url
                }

                return ThOptionCollectionModel.getMap().then(
                    function(optionCollectionMap) {
                        return $http.get(href).then(function(response) {
                            return {
                                results: _.map(response.data.results, function(alertSummaryData) {
                                    return new AlertSummary(alertSummaryData, optionCollectionMap);
                                }),
                                next: response.data.next
                            };
                        });
                    });
            },
            changeAlertSummaryStatus: function(alertSummaryId, open) {
            }
        };
    }]);

perf.controller(
    'ModifyAlertSummaryCtrl',
    function($scope, $modalInstance, alertSummary) {
        $scope.title = "Link to bug";
        $scope.placeholder = "Bug #";

        $scope.update = function() {
            var newId = parseInt(
                $scope.modifyAlert.newId.$modelValue);

            $scope.modifying = true;
            alertSummary.assignBug(newId).then(function() {
                $scope.modifying = false;
                $modalInstance.close('assigned');
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

perf.controller(
    'MarkDownstreamAlertsCtrl',
    function($scope, $modalInstance, $http, $q, alertSummary, allAlertSummaries,
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
                        $modalInstance.close('downstreamed');
                    });
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

perf.controller(
    'ReassignAlertsCtrl',
    function($scope, $modalInstance, $http, $q, alertSummary,
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
                console.log(summariesToUpdate);
                $q.all(_.map(summariesToUpdate, function(alertSummary) {
                    return alertSummary.update();
                })).then(function() {
                    $modalInstance.close('downstreamed');
                });
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
    'thUrl', 'ThRepositoryModel', 'ThOptionCollectionModel',
    'ThResultSetModel',
    'PhFramework', 'PhSeries', 'PhAlerts', 'PhBugs', 'phTimeRanges',
    'phDefaultTimeRangeValue', 'phAlertSummaryStatusMap', 'phAlertStatusMap',
    'dateFilter', 'thDateFormat',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        $modal,
                        thUrl, ThRepositoryModel,
                        ThOptionCollectionModel, ThResultSetModel,
                        PhFramework, PhSeries, PhAlerts, PhBugs, phTimeRanges,
                        phDefaultTimeRangeValue, phAlertSummaryStatusMap, phAlertStatusMap,
                        dateFilter, thDateFormat) {
        $scope.alertSummaries = undefined;
        $scope.getMoreAlertSummariesHref = null;
        $scope.getCappedMagnitude = function(percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression == 100% bad)
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
                });
                alertSummary.anyVisible = _.any(alertSummary.alerts,
                                                'visible');
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
                    });
            } else {
                console.log("They see me rollin', they updatin' alert visibility");
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
            PhBugs.fileTalosBug(alertSummary);
        };
        $scope.linkToBug = function(alertSummary) {
            $modal.open({
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
        $scope.markWontfix = function(alertSummary) {
            alertSummary.updateStatus(phAlertSummaryStatusMap.WONTFIX);
        };
        $scope.markResolved = function(alertSummary) {
            alertSummary.updateStatus(phAlertSummaryStatusMap.RESOLVED);
        };
        $scope.markInvestigating = function(alertSummary) {
            alertSummary.updateStatus(phAlertSummaryStatusMap.INVESTIGATING);
        };
        $scope.markAlertsDownstream = function(alertSummary) {
            $modal.open({
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
            $modal.open({
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

        ThRepositoryModel.load().then(function(response) {
            $q.all([PhFramework.getFrameworkList().then(
                function(frameworks) {
                    $scope.frameworks = frameworks.data;
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
                              parseInt($stateParams.hideImprovements)
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
                              frameworkFilter: $scope.filterOptions.framework.id
                          }).then(
                              function(data) {
                                  addAlertSummaries(data.results, data.next);
                              });
                      }
                  });
        });
    }
]);
