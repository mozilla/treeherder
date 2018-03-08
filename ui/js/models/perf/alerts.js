import treeherder from '../../treeherder';
import { getApiUrl } from "../../../helpers/urlHelper";

treeherder.factory('PhAlerts', [
    '$http', '$httpParamSerializer', '$q', 'ThOptionCollectionModel', 'PhSeries',
    'phAlertSummaryStatusMap', 'phAlertSummaryIssueTrackersMap', 'phAlertStatusMap', 'thPerformanceBranches', 'displayNumberFilter',
    function ($http, $httpParamSerializer, $q, ThOptionCollectionModel, PhSeries,
             phAlertSummaryStatusMap, phAlertSummaryIssueTrackersMap, phAlertStatusMap, thPerformanceBranches, displayNumberFilter) {

        const Alert = function (alertData, optionCollectionMap) {
            _.assign(this, alertData);
            this.title = PhSeries.getSeriesName(
                this.series_signature, optionCollectionMap,
                { includePlatformInName: true });
        };
        Alert.prototype.getStatusText = function () {
            return _.result(_.find(phAlertStatusMap, { id: this.status }),
                            'text');
        };
        Alert.prototype.getGraphsURL = function (timeRange, alertRepository,
                                                performanceFrameworkId) {
            let url = `#/graphs?timerange=${timeRange}&series=${alertRepository},${this.series_signature.id},1`;

            // for talos only, automatically add related branches (we take advantage of
            // the otherwise rather useless signature hash to avoid having to fetch this
            // information from the server)
            if (performanceFrameworkId === 1) {
                const branches = (alertRepository === "mozilla-beta") ? ['mozilla-inbound'] : thPerformanceBranches.filter(branch => branch !== alertRepository);
                url += branches.map(branch => `&series=${branch},${this.series_signature.signature_hash},0`).join("");
            }

            return url;
        };
        Alert.prototype.getSubtestsURL = function (alertSummary) {
            const endpoint = '#/comparesubtest';
            const urlParameters = {
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
        Alert.prototype.modify = function (modification) {
            return $http.put(getApiUrl(`/performance/alert/${this.id}/`),
                             modification);
        };
        _.forEach(phAlertStatusMap, function (status) {
            Alert.prototype['is' + _.capitalize(status.text)] = function () {
                return this.status === status.id;
            };
        });

        const AlertSummary = function (alertSummaryData, optionCollectionMap) {
            _.assign(this, alertSummaryData);
            this._initializeAlerts(optionCollectionMap);
        };
        _.forEach(phAlertSummaryStatusMap, function (status) {
            AlertSummary.prototype['is' + _.capitalize(status.text)] = function () {
                return this.status === status.id;
            };
            AlertSummary.prototype['mark' + _.capitalize(status.text)] = function () {
                this.updateStatus(status);
            };
        });
        AlertSummary.prototype.getIssueTrackerUrl = function () {
            if (this.issue_tracker) {
                const issueTrackerUrl = _.find(phAlertSummaryIssueTrackersMap, { id: this.issue_tracker }).issueTrackerUrl;
                return issueTrackerUrl + this.bug_number;
            }
        };
        AlertSummary.prototype.getTextualSummary = function (copySummary) {
            let resultStr = "";
            const improved = _.sortBy(
                this.alerts.filter(alert => !alert.is_regression && alert.visible),
                'amount_pct'
            ).reverse();
            const regressed = _.sortBy(
                this.alerts.filter(alert => alert.is_regression && alert.visible && !alert.isInvalid()),
                'amount_pct'
            ).reverse();

            const formatAlert = function (alert, alertList) {
                return _.padStart(alert.amount_pct.toFixed(0), 3) + "%  " +
                _.padEnd(alert.title, _.max(alertList, function (alert) { return alert.title.length; }).title.length +5) +
                displayNumberFilter(alert.prev_value) + " -> " + displayNumberFilter(alert.new_value);
            };

            // add summary header if getting text for clipboard only
            if (copySummary) {
                const lastUpdated = new Date(this.last_updated);
                resultStr += `== Change summary for alert #${this.id} (as of ${lastUpdated.toUTCString()}) ==\n`;
            }
            if (regressed.length > 0) {
                // add a newline if we displayed the header
                if (copySummary) {
                    resultStr += "\n";
                }
                resultStr += "Regressions:\n\n" +
                             _.map(regressed, function (alert) {
                                 return formatAlert(alert, regressed);
                             }).join('\n') + "\n";
            }
            if (improved.length > 0) {
                // Add a newline if we displayed some regressions
                if (resultStr.length > 0) {
                    resultStr += "\n";
                }
                resultStr += "Improvements:\n\n" +
                             _.map(improved, function (alert) {
                                 return formatAlert(alert, improved);
                             }).join('\n') + "\n";
            }
            // include link to alert if getting text for clipboard only
            if (copySummary) {
                const alertLink = window.location.origin + '/perf.html#/alerts?id=' + this.id;
                resultStr += "\nFor up to date results, see: " + alertLink;
            }
            return resultStr;
        };
        AlertSummary.prototype.isResolved = function () {
            return this.isFixed() || this.isWontfix() || this.isBackedout();
        };
        AlertSummary.prototype._initializeAlerts = function (optionCollectionMap) {
            // this function converts the representation returned by the perfherder
            // api into a representation more suited for display in the UI

            // just treat related (reassigned or downstream) alerts as one
            // big block -- we'll display in the UI depending on their content
            this.alerts = _.map(this.alerts.concat(this.related_alerts),
                function (alertData) {
                    return new Alert(alertData, optionCollectionMap);
                });
        };
        AlertSummary.prototype.updateStatus = function (newStatus) {
            const alertSummary = this;
            return $http.put(getApiUrl(`/performance/alertsummary/${this.id}/`),
                             { status: newStatus.id }).then(function () {
                                 alertSummary.status = newStatus.id;
                             });
        };
        AlertSummary.prototype.update = function () {
            const alertSummary = this;
            return $http.get(getApiUrl(`/performance/alertsummary/${this.id}/`)).then(
                                 function (response) {
                                     return ThOptionCollectionModel.getMap().then(
                                         function (optionCollectionMap) {
                                             _.assign(alertSummary, response.data);
                                             alertSummary._initializeAlerts(
                                                 optionCollectionMap);
                                         });
                                 });
        };
        AlertSummary.prototype.getTitle = function () {
            let title;

            // we should never include downstream alerts in the description
            const alertSummary = this;
            let alertsInSummary = this.alerts.filter(alert =>
                (alert.status !== phAlertStatusMap.DOWNSTREAM.id ||
                        alert.summary_id === alertSummary.id)
            );

            // figure out if there are any regressions -- if there are,
            // the summary should only incorporate those. if there
            // aren't, then use all of them (that aren't downstream,
            // see above)
            if (_.some(_.map(alertsInSummary, 'is_regression'))) {
                alertsInSummary = alertsInSummary.filter(alert => alert.is_regression);
            }

            if (alertsInSummary.length > 1) {
                title = _.min(_.map(alertsInSummary, 'amount_pct')) + " - " +
                    _.max(_.map(alertsInSummary, 'amount_pct')) + "%";
            } else if (alertsInSummary.length === 1) {
                title = alertsInSummary[0].amount_pct + "%";
            } else {
                title = "Empty alert";
            }
            // add test info
            title += " " + _.uniq(
                _.map(alertsInSummary, function (a) {
                    return PhSeries.getTestName(a.series_signature);
                })).sort().join(' / ');
            // add platform info
            title += " (" + _.uniq(
                _.map(alertsInSummary, function (a) {
                    return a.series_signature.machine_platform;
                })).sort().join(', ') + ')';
            return title;
        };
        AlertSummary.prototype.assignBug = function (taskNumber, issueTrackerId) {
            const alertSummary = this;
            return $http.put(getApiUrl(`/performance/alertsummary/${this.id}/`),
                             { bug_number: taskNumber, issue_tracker: issueTrackerId }).then(function () {
                                 return alertSummary.update();
                             });
        };
        AlertSummary.prototype.modifySelectedAlerts = function (modification) {
            this.allSelected = false;

            return $q.all(this.alerts.filter(alert => alert.selected).map(
                function (selectedAlert) {
                    selectedAlert.selected = false;
                    return selectedAlert.modify(modification);
                }));
        };
        AlertSummary.prototype.getStatusText = function () {
            return _.find(phAlertSummaryStatusMap, { id: this.status }).text;
        };

        function _getAlertSummary(id) {
            // get a specific alert summary
            // in order to cancel the http request, a canceller must be used
            // http://odetocode.com/blogs/scott/archive/2014/04/24/canceling-http-requests-in-angularjs.aspx
            const canceller = $q.defer();
            const promise = ThOptionCollectionModel.getMap().then(
                function (optionCollectionMap) {
                    return $http.get(getApiUrl(`/performance/alertsummary/${id}/`),
                                    { timeout: canceller.promise }).then(
                                        function (response) {
                                            return new AlertSummary(response.data,
                                                                    optionCollectionMap);
                                        }
                    );
                }
            );
            promise.cancel = function () {
                canceller.resolve();
            };
            return promise;
        }

        return {
            getAlertSummary: _getAlertSummary,
            getAlertSummaryTitle: function (id) {
                const request = _getAlertSummary(id);
                const promise = request.then(function (alertSummary) {
                    return alertSummary.getTitle();
                });
                promise.cancel = request.cancel;
                return promise;
            },
            getAlertSummaries: function (options) {
                let href;
                if (!options || !options.href) {
                    href = getApiUrl('/performance/alertsummary/');

                    // add filter parameters for status and framework
                    const params = [];
                    if (options && !_.isUndefined(options.statusFilter) &&
                        options.statusFilter !== (-1)) {
                        params[params.length] = ("status=" + options.statusFilter);
                    }
                    if (options && !_.isUndefined(options.frameworkFilter)) {
                        params[params.length] = ("framework=" + options.frameworkFilter);
                    }
                    if (options && !_.isUndefined(options.signatureId)) {
                        params[params.length] = ("alerts__series_signature=" +
                                                 options.signatureId);
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
                    function (optionCollectionMap) {
                        return $http.get(href).then(function (response) {
                            return {
                                results: _.map(response.data.results, function (alertSummaryData) {
                                    return new AlertSummary(alertSummaryData, optionCollectionMap);
                                }),
                                next: response.data.next,
                                count: response.data.count
                            };
                        });
                    });
            },
            createAlert: function (data) {
                return $http.post(getApiUrl('/performance/alertsummary/'), {
                    repository_id: data.project.id,
                    framework_id: data.series.frameworkId,
                    push_id: data.resultSetId,
                    prev_push_id: data.prevResultSetId
                }).then(function (response) {
                    const newAlertSummaryId = response.data.alert_summary_id;
                    return $http.post(getApiUrl('/performance/alert/'), {
                        summary_id: newAlertSummaryId,
                        signature_id: data.series.id
                    }).then(function () {
                        return newAlertSummaryId;
                    });
                });
            }
        };
    }]);
