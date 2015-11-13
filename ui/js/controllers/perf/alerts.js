"use strict";

perf.factory('PhAlerts', ['$http', 'thServiceDomain', function($http, thServiceDomain) {
    return {
        getAlertSummary: function(id) {
            return $http.get(thServiceDomain +
                             '/api/performance/alertsummary?id=' + id).then(
                                 function(response) {
                                     return response.data;
                                 });
        },
        getAlertSummaries: function(offset, count) {
            return $http.get(thServiceDomain +
                             '/api/performance/alertsummary?offset=' + offset +
                             '&count=' + count).then(function(response) {
                                 return response.data;
                             });
        }
    };
}]);

perf.controller('AlertsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$http', '$q', 'thUrl',
    'ThRepositoryModel', 'ThOptionCollectionModel', 'ThResultSetModel',
    'thDefaultRepo', 'PhSeries', 'PhAlerts', 'phTimeRanges', 'dateFilter', 'thDateFormat',
    function AlertsCtrl($state, $stateParams, $scope, $rootScope, $http, $q,
                        thUrl, ThRepositoryModel, ThOptionCollectionModel,
                        ThResultSetModel, thDefaultRepo, PhSeries, PhAlerts,
                        phTimeRanges, dateFilter, thDateFormat) {

        $scope.alertSummaries = [];
        $scope.getCappedMagnitude = function(percent) {
            // arbitrary scale from 0-20% multiplied by 5, capped
            // at 100 (so 20% regression == 100% bad)
            return Math.min(Math.abs(percent)*5, 100);
        };

        function addAlertSummaries(alertSummaries) {
            var resultSetToSummaryMap = {};

            alertSummaries.forEach(function(alertSummary) {
                if (!resultSetToSummaryMap[alertSummary.repository]) {
                    resultSetToSummaryMap[alertSummary.repository] = {};
                }
                _.forEach([alertSummary.result_set_id, alertSummary.prev_result_set_id],
                          function(resultSetId) {
                              if (!resultSetToSummaryMap[alertSummary.repository][
                                  resultSetId]) {
                                  resultSetToSummaryMap[alertSummary.repository][
                                      resultSetId] = [ alertSummary ];
                              } else {
                                  resultSetToSummaryMap[alertSummary.repository][
                                      resultSetId].push(alertSummary);
                              }
                          });

                alertSummary.alerts.forEach(function(alert) {
                    alert.title = PhSeries.getSeriesName(
                        alert, $scope.optionCollectionMap,
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
                return ThResultSetModel.getResultSets(
                    repo, 0, 1000,
                    _.keys(resultSetToSummaryMap[repo]), true, false).then(
                        function(response) {
                            response.data.results.forEach(function(resultSet) {
                                resultSet.dateStr = dateFilter(
                                    resultSet.push_timestamp*1000, thDateFormat);
                                // want at least 14 days worth of results for relative comparisons
                                resultSet.timeRange = Math.max(1209600, _.find(
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
            PhAlerts.getAlertSummaries($scope.alertSummaries.length,
                                       count).then(addAlertSummaries);
        };

        ThRepositoryModel.get_list().then(function(response) {
            $scope.projects = response.data;
            $scope.selectedProject = _.findWhere($scope.projects, {
                name: thDefaultRepo ? thDefaultRepo : thDefaultRepo
            });
            ThOptionCollectionModel.get_map().then(
                function(optionCollectionMap) {
                    $scope.optionCollectionMap = optionCollectionMap;
                    var alertPromise;
                    if ($stateParams.id) {
                        alertPromise = PhAlerts.getAlertSummary($stateParams.id);
                    } else {
                        alertPromise = PhAlerts.getAlertSummaries(0, 10);
                    }
                    alertPromise.then(addAlertSummaries);
                });

        });

    }
]);
