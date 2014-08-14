'use strict';

treeherder.factory('ThJobModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {
    // ThJobModel is the js counterpart of job

    var ThJobModel = function(data) {
        // creates a new instance of ThJobModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobModel.get_uri = function(repoName){return thUrl.getProjectUrl("/jobs/", repoName);};

    ThJobModel.get_list = function(repoName, options, config) {
        // a static method to retrieve a list of ThJobModel
        config = config || {};
        var timeout = config.timeout || null;

        return $http.get(ThJobModel.get_uri(repoName),{
                params: options,
                timeout:timeout
            })
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobModel(elem));
                });
                return item_list;
        });
    };

    ThJobModel.get = function(repoName, pk, config) {
        // a static method to retrieve a single instance of ThJobModel
        config = config || {};
        var timeout = config.timeout || null;

        return $http.get(ThJobModel.get_uri(repoName)+pk+"/",
            {timeout:timeout})
            .then(function(response) {
            return new ThJobModel(response.data);
        });
    };

    ThJobModel.cancel = function(repoName, pk, config) {
        // a static method to retrieve a single instance of ThJobModel
        config = config || {};
        var timeout = config.timeout || null;

        return $http.post(ThJobModel.get_uri(repoName)+pk+"/cancel/",
            {timeout:timeout})
            .then(function(response) {
            return new ThJobModel(response.data);
        });
    };

    return ThJobModel;
}]);
