'use strict';

treeherder.factory('ThOptionCollectionModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {
        var optionCollectionMap = {};
        var loadPromise = $http.get(
            thUrl.getRootUrl("/optioncollectionhash/")).then(
                function(response) {
                    // return a map of option collection hashes to a string
                    // representation of their contents
                    // (e.g. 102210fe594ee9b33d82058545b1ed14f4c8206e -> opt)
                    _.each(response.data, function(optColl) {
                        optionCollectionMap[optColl.option_collection_hash] =
                            _.uniq(_.map(optColl.options, function(option) {
                                return option.name;
                            })).sort().join();
                    });
                });

        return {
            getMap: function() {
                return loadPromise.then(function() {
                    return optionCollectionMap;
                });
            }
        };
    }]);
