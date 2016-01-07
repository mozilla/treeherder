'use strict';

treeherder.factory('ThMatcherModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

        // ThJobTypeModel is the js counterpart of job_type

        var ThMatcherModel = function(data) {
            // creates a new instance of ThJobTypeModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThMatcherModel.get_uri = function(){
            var url = thUrl.getRootUrl("/matcher/");
            return url;
        };

        ThMatcherModel.get_list = function(options) {
            // a static method to retrieve a list of ThMatcherModel
            options = options || {};
            return $http.get(ThMatcherModel.get_uri(),{
                cache: true,
                params: options
            }).
                then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThMatcherModel(elem));
                    });
                    return item_list;
                });
        };

        ThMatcherModel.get = function(pk) {
            // a static method to retrieve a single instance of ThMatcherModel
            return $http.get(ThMatcherModel.get_uri()+pk).then(function(response) {
                return new ThMatcherModel(response.data);
            });
        };

        return ThMatcherModel;
    }]);
