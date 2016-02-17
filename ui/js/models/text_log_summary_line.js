'use strict';

treeherder.factory('ThTextLogSummaryLineModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {

        var ThTextLogSummaryLineModel = function(data) {
            // creates a new instance of ThTextLogSummaryLineModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThTextLogSummaryLineModel.get_url = function() {
            return thUrl.getRootUrl("/text-log-summary-line/");
        };

        ThTextLogSummaryLineModel.prototype.update = function(bug_number) {
            var summary_line = this;
            summary_line.bug_number = bug_number;
            summary_line.verified = true;
            return $http.put(ThTextLogSummaryLineModel.get_url() + summary_line.id + "/",
                             {bug_number: bug_number,
                              verified: true});
        };

        ThTextLogSummaryLineModel.updateMany = function(data) {
            if (!data.length) {
                return Promise.resolve();
            }
            return $http.put(ThTextLogSummaryLineModel.get_url(), data);
        };

        return ThTextLogSummaryLineModel;
    }]);
