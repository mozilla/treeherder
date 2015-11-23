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
        }
    };
}]);

perf.controller('AlertsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$http', '$q', 'thUrl',
    'ThRepositoryModel', 'ThOptionCollectionModel', 'ThResultSetModel',
    'thDefaultRepo', 'PhSeries', 'PhAlerts', 'phTimeRanges', 'phDefaultTimeRangeValue',
    'dateFilter', 'thDateFormat',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        thUrl, ThRepositoryModel, ThOptionCollectionModel,
                        ThResultSetModel, thDefaultRepo, PhSeries, PhAlerts,
                        phTimeRanges, phDefaultTimeRangeValue, dateFilter,
                        thDateFormat) {

        $scope.alertSummaries = [];
        $scope.getMoreAlertSummariesHref = null;
        $scope.getCappedMagnitude = function(percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression == 100% bad)
            return Math.min(Math.abs(percent)*5, 100);
        };

        function addAlertSummaries(alertSummaries, getMoreAlertSummariesHref) {
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
                                // get a URL for examining the details of the
                                // result set in treeherder
                                _.forEach(alertSummaries, function(alertSummary) {
                                    if (alertSummary.prevResultSetMetadata &&
                                        alertSummary.resultSetMetadata) {
                                        alertSummary.pushURL = thUrl.getPushUrl(
                                            alertSummary.repository,
                                            alertSummary.prevResultSetMetadata.revision,
                                            alertSummary.resultSetMetadata.revision);
                                    } else {
                                        alertSummary.pushURL = "";
                                    }
                                });

                            });
                        });
            })).then(function() {
                $scope.alertSummaries = _.union($scope.alertSummaries,
                                                alertSummaries);
            });
        }

        $scope.getMoreAlertSummaries = function(count) {
            PhAlerts.getAlertSummaries($scope.getMoreAlertSummariesHref).then(
                function(data) {
                    addAlertSummaries(data.results, data.next)
                });
        };

        ThRepositoryModel.get_list().then(function(response) {
            $scope.projects = response.data;
            $scope.selectedProject = _.findWhere($scope.projects, {
                name: thDefaultRepo ? thDefaultRepo : thDefaultRepo
            });
            ThOptionCollectionModel.get_map().then(
                function(optionCollectionMap) {
                    $scope.optionCollectionMap = optionCollectionMap;
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
