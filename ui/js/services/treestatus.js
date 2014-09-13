'use strict';

treeherder.factory('treeStatus', [
    '$http', '$q',
    function($http, $q) {

    var urlBase = "https://treestatus.mozilla.org/";

    var getTreeStatusName = function(name) {
        // the thunderbird names in treestatus.mozilla.org don't match what
        // we use, so translate them.  pretty hacky, yes...
        // TODO: Move these to the repository fixture in the service.
        if (name.indexOf("comm-") >= 0 && name !== "try-comm-central") {
            return name + "-thunderbird";
        }
        return name;
    };

    var get = function(repoName) {
        var url = urlBase + getTreeStatusName(repoName);

        return $http.get(url, {params: {format: "json"}});
    };

    return {
        get: get,
        getTreeStatusName: getTreeStatusName,
    };
}]);

