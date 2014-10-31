/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.factory('ThOptionModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {
    // ThOptionModel is the js counterpart of option

    var ThOptionModel = function(data) {
        // creates a new instance of ThOptionModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThOptionModel.get_uri = function(){return thUrl.getRootUrl("/option/");};

    ThOptionModel.get_list = function(options) {
        options = options || {};
        // a static method to retrieve a list of ThOptionModel
        var query_string = $.param(options);
        return $http.get(ThOptionModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThOptionModel(elem));
                });
                return item_list;
        });
    };

    ThOptionModel.get = function(pk) {
        // a static method to retrieve a single instance of ThOptionModel
        return $http.get(ThOptionModel.get_uri()+pk).then(function(response) {
            return new ThOptionModel(response.data);
        });
    };

    return ThOptionModel;
}]);
