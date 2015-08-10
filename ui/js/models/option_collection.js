'use strict';

treeherder.factory('ThOptionCollectionModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {
        var get_list = function(options) {
            options = options || {};
            // a static method to retrieve a list of ThOptionCollectionModel
            var query_string = $.param(options);
            return $http.get(thUrl.getRootUrl("/optioncollectionhash/") + "?" +
                             query_string);
        };

        var get_map = function(options) {
            // convenience method which returns a map of option collection
            // hashes to a string representation of their contents
            // (e.g. 102210fe594ee9b33d82058545b1ed14f4c8206e -> opt)
            return get_list(options).then(function(optCollectionData) {
                var optionCollectionMap = {};
                _.each(optCollectionData.data, function(optColl) {
                    optionCollectionMap[optColl.option_collection_hash] =
                        _.uniq(_.map(optColl.options, function(option) {
                            return option.name;
                        })).sort().join();

                });
                return optionCollectionMap;
            });
        };

        return {
            get_list: get_list,
            get_map: get_map
        };
    }
]);
