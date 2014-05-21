'use strict';

treeherder.factory('thBuildApi', [
    '$http', '$location', 'thUrl', 'thServiceDomain', 'ThLog', 'thNotify',
    function($http, $location, thUrl, thServiceDomain, ThLog, thNotify) {

    var $log = new ThLog("thBuildApi");
    var selfServeUrl = "https://secure.pub.build.mozilla.org/buildapi/self-serve/";

    return {
        retriggerJob: function(repoName, buildId) {

            $http({
                url: selfServeUrl + repoName + "/build",
                method: "POST",
                data: "build_id=" + buildId,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                withCredentials: true
            }).
            success(function(data) {
                thNotify.send("job " + buildId + " retriggered");
            }).
            error(function(data) {
                thNotify.send("job " + buildId + " retrigger FAILED", "danger");
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
            });
        },
        cancelAll: function(repoName, revision) {
            return $http.delete(selfServeUrl + repoName + "/rev/" + revision,
                                {withCredentials: true}
            );
        }
    };
}]);
