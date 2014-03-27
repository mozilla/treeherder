'use strict';

treeherder.factory('treeStatus', function($http, $q) {

    var urlBase = "https://treestatus.mozilla.org/";

    var getTreeStatusName = function(name) {
        // the thunderbird names in treestatus.mozilla.org don't match what
        // we use, so translate them.  pretty hacky, yes...
        if (name.contains("thunderbird")) {
            if (name === "thunderbird-trunk") {
                return "comm-central-thunderbird";
            } else {
                var tokens = name.split("-");
                return "comm-" + tokens[1] + "-" + tokens[0];
            }
        }
        return name;
    };

    var get = function(repoName) {
        var url = urlBase + getTreeStatusName(repoName);

        return $http.get(url, {params: {format: "json"}})
            .then(function(data) {
                return data;
            });
    };

    return {
        get: get
    };
});

