/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.factory('ThOptionCollectionModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {
    // ThOptionCollectionModel is the js counterpart of option

    var ThOptionCollectionModel = function(data) {
        // creates a new instance of ThOptionCollectionModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThOptionCollectionModel.get_uri = function(){return thUrl.getRootUrl("/optioncollection/");};

    ThOptionCollectionModel.get_list = function(options) {
        options = options || {};
        // a static method to retrieve a list of ThOptionCollectionModel
        var query_string = $.param(options);
        return $http.get(ThOptionCollectionModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThOptionCollectionModel(elem));
                });
                return item_list;
        });
    };

    ThOptionCollectionModel.get = function(pk) {
        // a static method to retrieve a single instance of ThOptionCollectionModel
        return $http.get(ThOptionCollectionModel.get_uri()+pk).then(function(response) {
            return new ThOptionCollectionModel(response.data);
        });
    };

    return ThOptionCollectionModel;
}]);
