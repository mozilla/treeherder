'use strict';

treeherder.factory('ThJobModel', ['$http', '$log', 'thUrl', function($http, $log, thUrl) {
    // ThJobArtifactModel is the js counterpart of job_artifact

    var ThJobModel = function(data) {
        // creates a new instance of ThJobArtifactModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobModel.get_uri = function(){return thUrl.getProjectUrl("/jobs/");};

    ThJobModel.get_list = function(options) {
        // a static method to retrieve a list of ThJobModel
        var query_string = $.param(options);
        return $http.get(ThJobModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobModel(elem));
                });
                return item_list;
        });
    };

    ThJobModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobModel
        return $http.get(ThJobModel.get_uri()+pk+"/").then(function(response) {
            return new ThJobModel(response.data);
        });
    };

    return ThJobModel;
}]);
