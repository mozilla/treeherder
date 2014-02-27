treeherder.factory('ThJobArtifactModel', ['$http', '$log', 'thUrl', function($http, $log, thUrl) {
    // ThJobArtifactModel is the js counterpart of job_artifact

    var ThJobArtifactModel = function(data) {
        // creates a new instance of ThJobArtifactModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobArtifactModel.get_uri = function(){return thUrl.getProjectUrl("/artifact/");}

    ThJobArtifactModel.get_list = function(options) {
        // a static method to retrieve a list of ThJobArtifactModel
        var query_string = $.param(options)
        return $http.get(ThJobArtifactModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobArtifactModel(elem));
                });
                return item_list;
        });
    };

    ThJobArtifactModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobArtifactModel
        return $http.get(ThJobArtifactModel.get_uri()+pk).then(function(response) {
            return new ThJobArtifactModel(response.data);
        });
    };

    return ThJobArtifactModel;
}]);