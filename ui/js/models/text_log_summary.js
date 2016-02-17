'use strict';

treeherder.factory('ThTextLogSummaryModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {

        var ThTextLogSummaryModel = function(data) {
            // creates a new instance of ThTextLogSummaryModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThTextLogSummaryModel.get_url = function(job_id) {
            return thUrl.getProjectJobUrl("/text_log_summary/", job_id);
        };

        ThTextLogSummaryModel.get = function(job_id, config) {
            // a static method to retrieve a list of ThTextLogSummaryModel
            // the timeout configuration parameter is a promise that can be used to abort
            // the ajax request
            config = config || {};
            var timeout = config.timeout || null;

            return $http.get(ThTextLogSummaryModel.get_url(job_id),
                             {timeout: timeout,
                              cache: false})
                .then(function(response) {
                    return new ThTextLogSummaryModel(response.data);
                });
        };

        return ThTextLogSummaryModel;
    }]);
