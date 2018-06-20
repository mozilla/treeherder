import _ from 'lodash';
import capitalize from 'lodash/capitalize';

import treeherder from '../../treeherder';
import { getApiUrl } from '../../../helpers/url';
import OptionCollectionModel from '../../../models/optionCollection';
import {
  phAlertSummaryStatusMap,
  phAlertStatusMap,
  thPerformanceBranches,
} from '../../constants';

treeherder.factory('PhAlerts', [
    '$http', '$httpParamSerializer', '$q', 'PhSeries',
    'PhIssueTracker', 'displayNumberFilter',
    function ($http, $httpParamSerializer, $q, PhSeries,
             PhIssueTracker, displayNumberFilter) {

        let issueTrackers = null;

        const Alert = function (alertData, optionCollectionMap) {
            Object.assign(this, alertData);
            this.title = PhSeries.getSeriesName(
                this.series_signature, optionCollectionMap,
                { includePlatformInName: true });
        };
        Alert.prototype.getStatusText = function () {
            return Object.values(phAlertStatusMap).find(status =>
                status.id === this.status).text;
        };
        Alert.prototype.getGraphsURL = function (timeRange, alertRepository,
                                                performanceFrameworkId) {
            let url = `#/graphs?timerange=${timeRange}&series=${alertRepository},${this.series_signature.id},1`;

            // for talos only, automatically add related branches (we take advantage of
            // the otherwise rather useless signature hash to avoid having to fetch this
            // information from the server)
            if (performanceFrameworkId === 1) {
                const branches = (alertRepository === 'mozilla-beta') ? ['mozilla-inbound'] : thPerformanceBranches.filter(branch => branch !== alertRepository);
                url += branches.map(branch => `&series=${branch},${this.series_signature.signature_hash},0`).join('');
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
                newSignature: this.series_signature.signature_hash,
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
        Object.values(phAlertStatusMap).forEach((status) => {
            Alert.prototype['is' + capitalize(status.text)] = () => (
                this.status === status.id
            );
        });
        Alert.prototype.toggleStar = function () {
            const alert = this;
            const toggledStar = !this.starred;
            this.modify({
                starred: toggledStar,
            }).then(
                function () {
                    alert.starred = toggledStar;
                },
            );
        };

        const AlertSummary = function (alertSummaryData, optionCollectionMap) {
            Object.assign(this, alertSummaryData);
            this._initializeAlerts(optionCollectionMap);
        };
        AlertSummary.prototype.modify = function (modification) {
            return $http.put(getApiUrl(`/performance/alertsummary/${this.id}/`),
                             modification);
        };
        Object.values(phAlertSummaryStatusMap).forEach((status) => {
            AlertSummary.prototype['is' + capitalize(status.text)] = () => (
                this.status === status.id
            );
            AlertSummary.prototype['mark' + capitalize(status.text)] = () => {
                this.updateStatus(status);
            };
        });
        AlertSummary.prototype.getIssueTrackerUrl = function () {
            if (!this.bug_number) { return; }
            if (this.issue_tracker) {
                const issueTrackerUrl = issueTrackers.find(tracker => tracker.id === this.issue_tracker).issueTrackerUrl;
                return issueTrackerUrl + this.bug_number;
            }
        };
        AlertSummary.prototype.getTextualSummary = function (copySummary) {
            let resultStr = '';
            const improved = _.sortBy(
                this.alerts.filter(alert => !alert.is_regression && alert.visible),
                'amount_pct',
            ).reverse();
            const regressed = _.sortBy(
                this.alerts.filter(alert => alert.is_regression && alert.visible && !alert.isInvalid()),
                'amount_pct',
            ).reverse();

            const formatAlert = function (alert, alertList) {
                return _.padStart(alert.amount_pct.toFixed(0), 3) + '%  ' +
                _.padEnd(alert.title, _.max(alertList, function (alert) { return alert.title.length; }).title.length + 5) +
                displayNumberFilter(alert.prev_value) + ' -> ' + displayNumberFilter(alert.new_value);
            };

            // add summary header if getting text for clipboard only
            if (copySummary) {
                const lastUpdated = new Date(this.last_updated);
                resultStr += `== Change summary for alert #${this.id} (as of ${lastUpdated.toUTCString()}) ==\n`;
            }
            if (regressed.length > 0) {
                // add a newline if we displayed the header
                if (copySummary) {
                    resultStr += '\n';
                }
                resultStr += 'Regressions:\n\n' +
                             regressed.map(alert => (
                                 formatAlert(alert, regressed)
                             )).join('\n') + '\n';
            }
            if (improved.length > 0) {
                // Add a newline if we displayed some regressions
                if (resultStr.length > 0) {
                    resultStr += '\n';
                }
                resultStr += 'Improvements:\n\n' +
                             improved.map(alert => (
                                formatAlert(alert, improved)
                             )).join('\n') + '\n';
            }
            // include link to alert if getting text for clipboard only
            if (copySummary) {
                const alertLink = window.location.origin + '/perf.html#/alerts?id=' + this.id;
                resultStr += '\nFor up to date results, see: ' + alertLink;
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
            this.alerts = this.alerts.concat(this.related_alerts).map(alertData => (
                new Alert(alertData, optionCollectionMap)
            ));
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
                                     return OptionCollectionModel.getMap().then(
                                         function (optionCollectionMap) {
                                             Object.assign(alertSummary, response.data);
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
                        alert.summary_id === alertSummary.id),
            );

            // figure out if there are any regressions -- if there are,
            // the summary should only incorporate those. if there
            // aren't, then use all of them (that aren't downstream,
            // see above)
            const regressions = alertsInSummary.filter(alert => alert.is_regression);
            if (regressions.length > 0) {
                alertsInSummary = regressions;
            }

            if (alertsInSummary.length > 1) {
                title = _.min(alertsInSummary.map(alert => alert.amount_pct)) + ' - ' +
                    _.max(alertsInSummary.map(alert => alert.amount_pct)) + '%';
            } else if (alertsInSummary.length === 1) {
                title = alertsInSummary[0].amount_pct + '%';
            } else {
                title = 'Empty alert';
            }
            // add test info
            title += ' ' + [...new Set(
                    alertsInSummary.map(a => PhSeries.getTestName(a.series_signature)),
                )].sort().join(' / ');
            // add platform info
            title += ' (' + [...new Set(
                    alertsInSummary.map(a => a.series_signature.machine_platform),
                )].sort().join(', ') + ')';
            return title;
        };
        AlertSummary.prototype.assignBug = function (taskNumber, issueTrackerId) {
            const alertSummary = this;
            return $http.put(getApiUrl(`/performance/alertsummary/${this.id}/`),
                             { bug_number: taskNumber, issue_tracker: issueTrackerId }).then(function () {
                                 return alertSummary.update();
                             });
        };
        AlertSummary.prototype.unassignBug = function () {
            const alertSummary = this;
            return $http.put(getApiUrl(`/performance/alertsummary/${this.id}/`),
                             { bug_number: null }).then(function () {
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
            return Object.values(phAlertSummaryStatusMap).find(status =>
                status.id === this.status).text;
        };

        AlertSummary.prototype.saveNotes = function () {
            const alertSummary = this;
            return this.modify({ notes: this.notes }).then(() => {
                                alertSummary.originalNotes = alertSummary.notes;
                                alertSummary.notesChanged = false;
                             });
        };
        AlertSummary.prototype.editingNotes = function () {
            this.notesChanged = (this.notes !== this.originalNotes);
        };

        function _getAlertSummary(id) {
            // get a specific alert summary
            // in order to cancel the http request, a canceller must be used
            // http://odetocode.com/blogs/scott/archive/2014/04/24/canceling-http-requests-in-angularjs.aspx
            const canceller = $q.defer();
            const promise = OptionCollectionModel.getMap().then(
                function (optionCollectionMap) {
                    return $http.get(getApiUrl(`/performance/alertsummary/${id}/`),
                                    { timeout: canceller.promise }).then(
                                        function (response) {
                                            return new AlertSummary(response.data,
                                                                    optionCollectionMap);
                                        },
                    );
                },
            );
            promise.cancel = function () {
                canceller.resolve();
            };
            return promise;
        }

        PhIssueTracker.getIssueTrackerList().then((issueTrackerList) => {
            issueTrackers = issueTrackerList;
        });

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
                    if (options && options.statusFilter !== undefined &&
                        options.statusFilter !== (-1)) {
                        params[params.length] = ('status=' + options.statusFilter);
                    }
                    if (options && options.frameworkFilter !== undefined) {
                        params[params.length] = ('framework=' + options.frameworkFilter);
                    }
                    if (options && options.signatureId !== undefined) {
                        params[params.length] = ('alerts__series_signature=' +
                                                 options.signatureId);
                    }
                    if (options && options.repository !== undefined) {
                        params[params.length] = ('repository=' +
                                                 options.repository);
                    }
                    if (options && options.page !== undefined) {
                        params[params.length] = ('page=' + options.page);
                    }

                    if (params.length) {
                        href += '?' + params.join('&');
                    }
                } else {
                    href = options.href;
                    // status filter already in url if using pregenerated url
                }

                return OptionCollectionModel.getMap().then(
                    function (optionCollectionMap) {
                        return $http.get(href).then(function (response) {
                            return {
                                results: response.data.results.map(alertSummaryData => (
                                    new AlertSummary(alertSummaryData, optionCollectionMap)
                                )),
                                next: response.data.next,
                                count: response.data.count,
                            };
                        });
                    });
            },
            createAlert: function (data) {
                return $http.post(getApiUrl('/performance/alertsummary/'), {
                    repository_id: data.project.id,
                    framework_id: data.series.frameworkId,
                    push_id: data.resultSetId,
                    prev_push_id: data.prevResultSetId,
                }).then(function (response) {
                    const newAlertSummaryId = response.data.alert_summary_id;
                    return $http.post(getApiUrl('/performance/alert/'), {
                        summary_id: newAlertSummaryId,
                        signature_id: data.series.id,
                    }).then(function () {
                        return newAlertSummaryId;
                    });
                });
            },
        };
    }]);
