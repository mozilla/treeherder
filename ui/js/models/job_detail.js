'use strict';

treeherder.factory('ThJobDetailModel', [
    '$http', 'thUrl', function($http, thUrl) {
        return {
            getJobDetails: function(params, config) {
                config = config || {};
                var timeout = config.timeout || null;

                return $http.get(thUrl.getRootUrl("/jobdetail/"), {
                    params: params,
                    timeout: timeout
                }).then(function(response) {
                    return response.data.results;
                });
            }
        };
    }]);
