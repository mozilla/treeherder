'use strict';

treeherder.factory('ThJobFilterModel',
    ['$http', '$log', 'thUrl', 'thNotify', '$q', function($http, $log, thUrl, thNotify, $q) {
    // ThJobFilterModel is the js counterpart of JobFilter

    var ThJobFilterModel = function(data) {
        // creates a new instance of ThJobFilterModel
        // using the provided properties
        return angular.extend(this, data);
    };

    ThJobFilterModel.get_uri = function(){
        var url = thUrl.getRootUrl("/job-filter/");
        $log.log(url);
        return url;
    };

    ThJobFilterModel.get_list = function(options, cache) {
        // a static method to retrieve a list of ThJobFilterModel
        options = options || {};
        cache = cache || false;
        var query_string = $.param(options);
        return $http.get(ThJobFilterModel.get_uri()+"?"+query_string, {
            cache: cache
        })
        .then(function(response) {
            var item_list = [];
            angular.forEach(response.data, function(elem){
                item_list.push(new ThJobFilterModel(elem));
            });
            return item_list;
        });
    };

    ThJobFilterModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobFilterModel
        return $http.get(ThJobFilterModel.get_uri()+pk).then(function(response) {
            return new ThJobFilterModel(response.data);
        });
    };

    // an instance method to create a new ThJobFilterModel
    ThJobFilterModel.prototype.create = function() {
        var job_filter = this;
        return $http.post(ThJobFilterModel.get_uri(), job_filter)
        .then(
            function(response){
                angular.extend(job_filter, response.data);
                thNotify.send("Filter successfully created", "success");
            },
            function(reason){
                if(reason.status === 400){
                    angular.forEach(reason.data, function(error_list, field){
                        angular.forEach(error_list, function(error){
                            thNotify.send(error, "danger");
                        })
                    })
                }
                else{
                    thNotify.send(reason,"danger");
                }
                return $q.reject(reason);
            }
        );
    };

    // an instance method to create a new ThJobFilterModel
    ThJobFilterModel.prototype.update = function() {
        var job_filter = this;
        return $http.put(
                ThJobFilterModel.get_uri()+job_filter.id+"/",
                job_filter
            )
            .then(
                function(response){
                    angular.extend(job_filter, response.data.id);
                    thNotify.send("Job filter successfully updated", "success");
                },
                function(reason){
                    if(reason.status === 400){
                        angular.forEach(reason.data, function(error_list, field){
                            angular.forEach(error_list, function(error){
                                thNotify.send(field+": "+error, "danger");
                            })
                        })
                    }
                    else{
                        thNotify.send(reason,"danger");
                    }
                    return $q.reject(reason);
                }
            );
    };

    // an instance method to delete a ThJobFilterModel object
    ThJobFilterModel.prototype.delete = function(){
        $log.log(this);
        var pk = this.id;
        return $http.delete(ThJobFilterModel.get_uri()+pk+"/")
            .then(
                function(response){
                    thNotify.send("Job filter successfully deleted", "success");
                },
                function(reason){
                    thNotify.send(reason.data,"danger");
                    return $q.reject(reason);
                }
            );
    };

    return ThJobFilterModel;
}]);
