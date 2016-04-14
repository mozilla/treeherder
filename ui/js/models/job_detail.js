'use strict';

treeherder.factory('ThJobDetailModel', [
    '$http', 'thUrl', function($http, thUrl) {
        return {
            getJobDetails: function(jobGuid, config) {
                config = config || {};
                var timeout = config.timeout || null;

                return $http.get(thUrl.getRootUrl("/jobdetail/"), {
                    params: { job_guid: jobGuid },
                    timeout: timeout
                }).then(function(response) {
                    return response.data.results;
                });
            }
        };
    }]);
