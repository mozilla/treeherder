'use strict';

treeherder.factory('thBuildApi', [
    '$http', '$location', 'thUrl', 'thServiceDomain', 'ThLog',
    function($http, $location, thUrl, thServiceDomain, ThLog) {

    var $log = new ThLog("thBuildApi");
    var selfServeUrl = "https://secure.pub.build.mozilla.org/buildapi/self-serve/";

    return {
        retrigger: function(repoName, buildId) {

            var params = {
                build_id: buildId
            };

            return $http.post(selfServeUrl + repoName + "/build",
                              {params: params}
            );
        },
        cancel: function(repoName, buildId) {
            return $http.delete(selfServeUrl + repoName + "/build/" + buildId);
        }
    };
}]);
