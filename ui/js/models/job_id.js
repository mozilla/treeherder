'use strict';

treeherder.factory('TheJobId', [
    '$http', 'thUrl', '$q',
    function($http, thUrl, $q) {
        // TheJobId model is the counterpart of job id
        return {
            getdata: function(projectName, jobId) {
                // just for test, it will become thUrl.get("/performance/data/?interval=86400&job_id="+jobId") after test
                return $http.get("http://local.treeherder.mozilla.org/api/project/mozilla-inbound/" +
                    "performance/data/?interval=86400&job_id="+jobId).then(
                    function(reponse) {
                        if(reponse.data) {
                            return reponse.data;
                        } else {
                            return $q.reject("No data been found for job id " +
                                                  jobId + " in project " + projectName);
                        }
                    }
                );
            }
        };
    }
]);
