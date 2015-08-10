'use strict';

treeherder.factory('ThBuildPlatformModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

        // ThBuildPlatform is the js counterpart of buildplatform

        var ThBuildPlatformModel = function(data) {
            // creates a new instance of ThBuildPlatformModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThBuildPlatformModel.get_uri = function(){
            var url = thUrl.getRootUrl("/buildplatform/");
            return url;
        };

        ThBuildPlatformModel.get_list = function(options) {
            // a static method to retrieve a list of ThBuildPlatformModel
            options = options || {};
            var query_string = $.param(options);
            return $http.get(ThBuildPlatformModel.get_uri()+"?"+query_string)
                .then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThBuildPlatformModel(elem));
                    });
                    return item_list;
                });
        };

        ThBuildPlatformModel.get = function(pk) {
            // a static method to retrieve a single instance of ThBuildPlatformModel
            return $http.get(ThBuildPlatformModel.get_uri()+pk).then(function(response) {
                return new ThBuildPlatformModel(response.data);
            });
        };

        return ThBuildPlatformModel;
    }]);
