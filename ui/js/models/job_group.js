'use strict';

treeherder.factory('ThJobGroupModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

        // ThJobGroupModel is the js counterpart of job_type

        var ThJobGroupModel = function(data) {
            // creates a new instance of ThJobGroupModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThJobGroupModel.get_uri = function(){
            var url = thUrl.getRootUrl("/jobgroup/");
            return url;
        };

        ThJobGroupModel.get_list = function(options) {
            // a static method to retrieve a list of ThJobGroupModel
            options = options || {};
            var query_string = $.param(options);
            return $http.get(ThJobGroupModel.get_uri(), {
                cache: true,
                params: options
            }).
                then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThJobGroupModel(elem));
                    });
                    return item_list;
                });
        };

        ThJobGroupModel.get = function(pk) {
            // a static method to retrieve a single instance of ThJobGroupModel
            return $http.get(ThJobGroupModel.get_uri()+pk).then(function(response) {
                return new ThJobGroupModel(response.data);
            });
        };

        return ThJobGroupModel;
    }]);
