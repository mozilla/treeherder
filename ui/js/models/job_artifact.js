'use strict';

treeherder.factory('ThJobArtifactModel', [
    '$http', 'ThLog', 'thUrl', '$q',
    function($http, ThLog, thUrl, $q) {

        // ThJobArtifactModel is the js counterpart of job_artifact

        var ThJobArtifactModel = function(data) {
            // creates a new instance of ThJobArtifactModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThJobArtifactModel.get_uri = function(){return thUrl.getProjectUrl("/artifact/");};

        ThJobArtifactModel.get_list = function(options, config, state) {
            // a static method to retrieve a list of ThJobArtifactModel
            // the timeout configuration parameter is a promise that can be used to abort
            // the ajax request
            config = config || {};
            var timeout = config.timeout || null;

            // Bail without fetching the log if there's no log to fetch
            if(state === "pending" || state === "running") {
                return $q(function(resolve, reject) {
                    resolve([]);
                });
            }

            return $http.get(ThJobArtifactModel.get_uri(),{
                params: options,
                timeout: timeout
            })
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
