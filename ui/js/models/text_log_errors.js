'use strict';

treeherder.factory('ThTextLogErrorsModel', [
    '$http', '$q', 'ThLog', 'thUrl',
    function($http, $q, ThLog, thUrl) {

        var ThTextLogErrorsModel = function(data) {
            angular.extend(this, data);
        };

        ThTextLogErrorsModel.getUrl = function(job_id) {
            return thUrl.getProjectJobUrl("/text_log_errors/", job_id);
        };

        ThTextLogErrorsModel.getList = function(job_id, config) {
            // a static method to retrieve a list of ThTextLogErrorsModel
            // the timeout configuration parameter is a promise that can be used to abort
            // the ajax request
            config = config || {};
            var timeout = config.timeout || null;
            return $http.get(ThTextLogErrorsModel.getUrl(job_id), {
                timeout: timeout,
                cache: false
            })
            .then(function(response) {
                return response.data
                    .map(elem => new ThTextLogErrorsModel(elem));
            });
        };

        ThTextLogErrorsModel.verify = function(lineId, bestClassification, bugNumber) {
            return $http.put(thUrl.getRootUrl("/text-log-error/" + lineId + "/"),
                             {best_classification: bestClassification,
                              bug_number: bugNumber});
        };

        ThTextLogErrorsModel.verifyMany = function(data) {
            if (!data.length) {
                return $q.resolve();
            }
            return $http.put(thUrl.getRootUrl("/text-log-error/"), data);
        };

        return ThTextLogErrorsModel;
    }]);
