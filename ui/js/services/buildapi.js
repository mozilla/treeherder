'use strict';

treeherder.factory('thBuildApi', [
    '$http', '$location', 'thUrl', 'thServiceDomain', 'ThLog', 'thNotify',
    function($http, $location, thUrl, thServiceDomain, ThLog, thNotify) {

    var $log = new ThLog("thBuildApi");
    var selfServeUrl = "https://secure.pub.build.mozilla.org/buildapi/self-serve/";

    return {
        retriggerJob: function(repoName, requestId) {

            $http({
                url: selfServeUrl + repoName + "/request",
                method: "POST",
                data: "request_id=" + requestId,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                withCredentials: true
            }).then(
            function(data) {
                thNotify.send("job with request of " + requestId + " retriggered");
            },
            function(data) {
                thNotify.send("job with request of " + requestId + " retrigger FAILED", "danger");
            });
        },
        cancelJob: function(repoName, requestId) {
            return $http({
                url: selfServeUrl + repoName + "/request/" + requestId,
                method: "POST",
                data: "_method=DELETE",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                withCredentials: true
            }).
            success(function(data) {
                thNotify.send("job with request of " + requestId + " cancelled");
            }).
            error(function(data) {
                thNotify.send("job with request of " + requestId + " cancel FAILED", "danger");
            });
        },
        cancelAll: function(repoName, revision) {
            return $http.delete(selfServeUrl + repoName + "/rev/" + revision,
                                {withCredentials: true}
            );
        }
    };
}]);
