'use strict';

treeherder.factory('ThBugJobMapModel', [
    '$http', 'thUrl',
    function($http, thUrl) {
        // ThBugJobMap is a class which we can use for retrieving and
        // updating data on the server
        var ThBugJobMapModel = function(data) {
            angular.extend(this, data);
        };

        ThBugJobMapModel.get_uri = function(){return thUrl.getProjectUrl("/bug-job-map/");};

        // a static method to retrieve a list of ThBugJobMap
        // the options parameter is used to filter/limit the list of objects
        ThBugJobMapModel.get_list = function(options) {
            var query_string = $.param(options);
            return $http.get(ThBugJobMapModel.get_uri()+"?"+query_string).then(function(response) {
                var item_list = [];
                _.each(response.data, function(elem){
                    item_list.push(new ThBugJobMapModel(elem));
                });
                return item_list;
            });
        };

        // a static method to retrieve a single instance of ThBugJobMap
        ThBugJobMapModel.get = function(pk) {
            return $http.get(ThBugJobMapModel.get_uri()+pk).then(function(response) {
                return new ThBugJobMapModel(response.data);
            });
        };

        // an instance method to create a new ThBugJobMap
        ThBugJobMapModel.prototype.create = function() {
            var bug_job_map = this;
            return $http.post(ThBugJobMapModel.get_uri(), bug_job_map);
        };

        // an instance method to delete a ThBugJobMap object
        ThBugJobMapModel.prototype.delete = function(){
            var pk = this.job_id+"-"+this.bug_id;
            return $http.delete(ThBugJobMapModel.get_uri()+pk+"/");
        };

        return ThBugJobMapModel;
    }
]);
