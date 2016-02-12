"use strict";

treeherder.factory('PhAlerts', [
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
            AlertSummary.prototype['mark' + _.capitalize(status.text)] = function() {
                this.updateStatus(status);
            };
        });
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
                    selectedAlert.selected = false;
                    return selectedAlert.modify(modification);
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
