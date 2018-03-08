import treeherder from '../treeherder';
import { getApiUrl } from '../../helpers/urlHelper';

treeherder.factory('ThOptionCollectionModel', [
    '$http',
    function ($http) {
        const optionCollectionMap = {};
        const loadPromise = $http.get(
            getApiUrl("/optioncollectionhash/")).then(
                function (response) {
                    // return a map of option collection hashes to a string
                    // representation of their contents
                    // (e.g. 102210fe594ee9b33d82058545b1ed14f4c8206e -> opt)
                    _.each(response.data, function (optColl) {
                        optionCollectionMap[optColl.option_collection_hash] =
                            _.uniq(_.map(optColl.options, function (option) {
                                return option.name;
                            })).sort().join();
                    });
                });

        return {
            getMap: function () {
                return loadPromise.then(function () {
                    return optionCollectionMap;
                });
            }
        };
    }]);
