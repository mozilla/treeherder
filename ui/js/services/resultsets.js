'use strict';

treeherder.factory('thResultSets',
                   function($http, $location, thUrl, thServiceDomain) {

    // get the resultsets for this repo
    return {
        getResultSets: function(rsOffsetId, count, resultsetlist) {
            rsOffsetId = typeof rsOffsetId === 'undefined'?  0: rsOffsetId;
            count = typeof count === 'undefined'?  10: count;
            var params = {
                count: count,
                full: false,
                format: "json"
            };

            if(rsOffsetId > 0){
                params['id__lt'] = rsOffsetId;
            }

            // if there are any search params on the url line, they should
            // pass directly to the set of resultsets.
            // with the exception of ``repo``.  That has no effect on the
            // service at this time, but it could be confusing.
            var locationParams = $location.search();
            delete locationParams.repo;
            _.extend(params, locationParams);

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
});
