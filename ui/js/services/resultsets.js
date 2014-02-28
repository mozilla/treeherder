'use strict';

treeherder.factory('thResultSets',
                   ['$http', 'thUrl', 'thServiceDomain',
                   function($http, thUrl, thServiceDomain) {

    // get the resultsets for this repo
    return {
        getResultSets: function(offset, count, resultsetlist) {
            offset = typeof offset === 'undefined'?  0: offset;
            count = typeof count === 'undefined'?  10: count;
            var params = {
                offset: offset,
                count: count,
                full: false,
                format: "json"
            };
            if (resultsetlist) {
                _.extend(params, {
                    offset: 0,
                    count: resultsetlist.length,
                    id__in: resultsetlist.join()
                });
            }
            return $http.get(thUrl.getProjectUrl("/resultset/"),
                             {params: params}
            );
        },
        get: function(uri) {
            return $http.get(thServiceDomain + uri, {params: {format: "json"}});
        }
    };
}]);
