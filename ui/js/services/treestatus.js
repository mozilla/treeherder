import treeherder from '../treeherder';

treeherder.factory('treeStatus', [
    '$http',
    function ($http) {
        const urlBase = "https://treestatus.mozilla-releng.net/trees/";

        const getTreeStatusName = function (name) {
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
        const getRepoName = function (name) {
            return name.replace("-thunderbird", "");
        };

        const get = function (repoName) {
            const url = urlBase + getTreeStatusName(repoName);
            return $http.get(url);
        };

        return {
            get: get,
            getTreeStatusName: getTreeStatusName,
            getRepoName: getRepoName
        };
    }]);

