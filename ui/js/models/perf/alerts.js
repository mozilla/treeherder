"use strict";

treeherder.factory('PhAlerts', [
    '$http', '$httpParamSerializer', '$q', 'thServiceDomain', 'ThOptionCollectionModel', 'PhSeries',
    'phAlertSummaryStatusMap', 'phAlertStatusMap', 'thPerformanceBranches',
    function($http, $httpParamSerializer, $q, thServiceDomain, ThOptionCollectionModel, PhSeries,
             phAlertSummaryStatusMap, phAlertStatusMap, thPerformanceBranches) {

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
        Alert.prototype.getGraphsURL = function(timeRange, alertRepository,
                                                performanceFrameworkId) {
            var signature = this.series_signature.signature_hash;
            var url = "#/graphs?timerange=" + timeRange +
                "&series=[" + [alertRepository, signature, 1] + "]" +
                "&selected=[" + [alertRepository, signature] + "]";

            // for talos only, automatically add related branches
            if (performanceFrameworkId === 1) {
                _.forEach(thPerformanceBranches, function(performanceBranch) {
                    if (performanceBranch !== alertRepository) {
                        url += "&series=[" + [performanceBranch, signature, 0] + "]";
                    }
                });
                if (alertRepository === "mozilla-beta") {
                    url += "&series=[" + ["mozilla-aurora", signature, 0] + "]";
                }
            }

            return url;
        };
        Alert.prototype.getSubtestsURL = function(alertSummary) {
            var endpoint = '#/comparesubtest';
            var urlParameters = {
                framework: alertSummary.framework,
                originalProject: alertSummary.repository,
                originalSignature: this.series_signature.signature_hash,
                newProject: alertSummary.repository,
                newSignature: this.series_signature.signature_hash
            };
            if (alertSummary.prevResultSetMetadata) {
                urlParameters.originalRevision = alertSummary.prevResultSetMetadata.revision;
            }
            if (alertSummary.prevResultSetMetadata) {
                urlParameters.newRevision = alertSummary.resultSetMetadata.revision;
            }

            return endpoint + '?' + $httpParamSerializer(urlParameters);
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
            AlertSummary.prototype['mark' + _.capitalize(status.text)] = function() {
                this.updateStatus(status);
            };
        });
        AlertSummary.prototype.getTextualSummary = function(copySummary) {
            var resultStr = "";
            var improved = _.sortBy(_.filter(this.alerts, function(alert) {
                return !alert.is_regression && alert.visible;}),
            'amount_pct').reverse();
            var regressed = _.sortBy(_.filter(this.alerts, function(alert) {
                return alert.is_regression && alert.visible && !alert.isInvalid();}),
            'amount_pct').reverse();

            var formatAlert = function(alert, alertList){
                return _.padLeft(alert.amount_pct.toFixed(0), 3) + "%  " +
                _.padRight(alert.title, _.max(alertList, function(alert){ return alert.title.length; }).title.length +5) +
               alert.prev_value + " -> " + alert.new_value ;
            };

            // add summary header if getting text for clipboard only
            if (copySummary) {
                var lastUpdated = new Date(this.last_updated);
                resultStr += "== Change summary for alert #" + this.id +
                             " (as of " + lastUpdated.toLocaleFormat("%B %d %Y %H:%M UTC") + ") ==\n";
            }
            if (regressed.length > 0) {
                // add a newline if we displayed the header
                if (copySummary) {
                    resultStr += "\n";
                }
                resultStr += "Regressions:\n\n" +
                             _.map(regressed, function(alert){
                                 return formatAlert(alert, regressed);
                             }).join('\n') + "\n";
            }
            if (improved.length > 0) {
                // Add a newline if we displayed some regressions
                if (resultStr.length > 0) {
                    resultStr += "\n";
                }
                resultStr += "Improvements:\n\n" +
                             _.map(improved, function(alert) {
                                 return formatAlert(alert, improved);
                             }).join('\n') + "\n";
            }
            // include link to alert if getting text for clipboard only
            if (copySummary) {
                var alertLink = window.location.origin + '/perf.html#/alerts?id=' + this.id;
                resultStr += "\nFor up to date results, see: " + alertLink;
            }
            return resultStr;
        };
        AlertSummary.prototype.isResolved = function() {
            return this.isFixed() || this.isWontfix() || this.isBackedout();
        };
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
        AlertSummary.prototype.getTitle = function() {
            var title;

            // we should never include downstream alerts in the description
            var alertSummary = this;
            var alertsInSummary = _.filter(this.alerts, function(alert) {
                return (alert.status !== phAlertStatusMap.DOWNSTREAM.id ||
                        alert.summary_id === alertSummary.id);
            });

            // figure out if there are any regressions -- if there are,
            // the summary should only incorporate those. if there
            // aren't, then use all of them (that aren't downstream,
            // see above)
            if (_.any(_.pluck(alertsInSummary, 'is_regression'))) {
                alertsInSummary = _.filter(alertsInSummary, 'is_regression');
            }

            if (alertsInSummary.length > 1) {
                title = _.min(_.pluck(alertsInSummary, 'amount_pct')) + " - " +
                    _.max(_.pluck(alertsInSummary, 'amount_pct')) + "%";
            } else if (alertsInSummary.length === 1) {
                title = alertsInSummary[0].amount_pct + "%";
            } else {
                title = "Empty alert";
            }
            // add test info
            title += " " + _.uniq(
                _.map(alertsInSummary, function(a) {
                    return PhSeries.getTestName(a.series_signature, { abbreviate:true });
                })).sort().join(' / ');
            // add platform info
            title += " (" + _.uniq(
                _.map(alertsInSummary, function(a) {
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
                    selectedAlert.selected = false;
                    return selectedAlert.modify(modification);
                }));
        };
        AlertSummary.prototype.getStatusText = function() {
            return _.find(phAlertSummaryStatusMap, { id: this.status }).text;
        };

        function _getAlertSummary(id) {
            // get a specific alert summary
            // in order to cancel the http request, a canceller must be used
            // http://odetocode.com/blogs/scott/archive/2014/04/24/canceling-http-requests-in-angularjs.aspx
            var canceller = $q.defer();
            var promise = ThOptionCollectionModel.getMap().then(
                function(optionCollectionMap) {
                    return $http.get(thServiceDomain + '/api/performance/alertsummary/' + id + '/',
                                    {timeout : canceller.promise}).then(
                                        function(response) {
                                            return new AlertSummary(response.data,
                                                                    optionCollectionMap);
                                        }
                    );
                }
            );
            promise.cancel = function() {
                canceller.resolve();
            };
            return promise;
        }

        return {
            getAlertSummary: _getAlertSummary,
            getAlertSummaryTitle: function(id) {
                var request = _getAlertSummary(id);
                var promise = request.then(function(alertSummary) {
                    return alertSummary.getTitle();
                });
                promise.cancel = request.cancel;
                return promise;
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
                    if (options && !_.isUndefined(options.seriesSignature)) {
                        params[params.length] = ("alerts__series_signature__signature_hash=" +
                                                 options.seriesSignature);
                    }
                    if (options && !_.isUndefined(options.repository)) {
                        params[params.length] = ("repository=" +
                                                 options.repository);
                    }
                    if (options && !_.isUndefined(options.page)) {
                        params[params.length] = ("page=" + options.page);
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
                                next: response.data.next,
                                count: response.data.count
                            };
                        });
                    });
            },
            createAlert: function(data) {
                return $http.post(thServiceDomain + '/api/performance/alertsummary/', {
                    repository_id: data.project.id,
                    framework_id: data.series.frameworkId,
                    result_set_id: data.resultSetId,
                    prev_result_set_id: data.prevResultSetId
                }).then(function(response) {
                    var newAlertSummaryId = response.data.alert_summary_id;
                    return $http.post(thServiceDomain + '/api/performance/alert/', {
                        summary_id: newAlertSummaryId,
                        signature_id: data.series.id
                    }).then(function() {
                        return newAlertSummaryId;
                    });
                });
            }
        };
    }]);
