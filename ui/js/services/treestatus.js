'use strict';

treeherder.factory('treeStatus', [
    '$http', '$q',
    function($http, $q) {
        var urlBase = "https://api.pub.build.mozilla.org/treestatus/trees/";

        var getTreeStatusName = function(name) {
            // the thunderbird names in api.pub.build.mozilla.org/treestatus don't match what
            // we use, so translate them.  pretty hacky, yes...
            // TODO: Move these to the repository fixture in the service.
            if (name.indexOf("comm-") >= 0 && name !== "try-comm-central") {
                return name + "-thunderbird";
            }
            return name;
        };

        // the inverse of getTreeStatusName.  Seems like overhead to put this one
        // line here, but it keeps the logic to do/undo all in one place.
        var getRepoName = function(name) {
            return name.replace("-thunderbird", "");
        };

        var get = function(repoName) {
            var url = urlBase + getTreeStatusName(repoName);

            return $http.get(url);
        };

        return {
            get: get,
            getTreeStatusName: getTreeStatusName,
            getRepoName: getRepoName
        };
    }]);

