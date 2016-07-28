'use strict';

treeherder.factory('ThJobExclusionModel', [
    '$http', '$log', 'thUrl', 'thNotify', '$q',
    function($http, $log, thUrl, thNotify, $q) {

        // ThJobExclusionModel is the js counterpart of JobFilter

        var ThJobExclusionModel = function(data) {
            // creates a new instance of ThJobExclusionModel
            // using the provided properties
            return angular.extend(this, data);
        };

        ThJobExclusionModel.get_uri = function(){
            var url = thUrl.getRootUrl("/job-exclusion/");
            return url;
        };

        ThJobExclusionModel.get_list = function(options, cache) {
            // a static method to retrieve a list of ThJobExclusionModel
            options = options || {};
            cache = cache || false;
            var query_string = $.param(options);
            return $http.get(ThJobExclusionModel.get_uri()+"?"+query_string, {
                cache: cache
            })
                .then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThJobExclusionModel(elem));
                    });
                    return item_list;
                });
        };

        ThJobExclusionModel.get = function(pk) {
            // a static method to retrieve a single instance of ThJobExclusionModel
            return $http.get(ThJobExclusionModel.get_uri()+pk).then(function(response) {
                return new ThJobExclusionModel(response.data);
            });
        };

        // an instance method to create a new ThJobExclusionModel
        ThJobExclusionModel.prototype.create = function() {
            var job_filter = this;
            return $http.post(ThJobExclusionModel.get_uri(), job_filter)
                .then(
                    function(response){
                        angular.extend(job_filter, response.data);
                        thNotify.send("Filter successfully created", "success");
                    },
                    function(reason){
                        if(reason.status === 400){
                            angular.forEach(reason.data, function(error_list){
                                angular.forEach(error_list, function(error){
                                    thNotify.send(error, "danger");
                                });
                            });
                        }
                        else{
                            thNotify.send(reason,"danger");
                        }
                        return $q.reject(reason);
                    }
                );
        };

        // an instance method to create a new ThJobExclusionModel
        ThJobExclusionModel.prototype.update = function() {
            var job_filter = this;
            return $http.put(
                ThJobExclusionModel.get_uri()+job_filter.id+"/",
                job_filter
            )
                .then(
                    function(response){
                        angular.extend(job_filter, response.data);
                        thNotify.send("Job filter successfully updated", "success");
                    },
                    function(reason){
                        if(reason.status === 400){
                            angular.forEach(reason.data, function(error_list, field){
                                angular.forEach(error_list, function(error){
                                    thNotify.send(field+": "+error, "danger");
                                });
                            });
                        }
                        else{
                            thNotify.send(reason,"danger");
                        }
                        return $q.reject(reason);
                    }
                );
        };

        // an instance method to delete a ThJobExclusionModel object
        ThJobExclusionModel.prototype.delete = function(){
            $log.debug(this);
            var pk = this.id;
            return $http.delete(ThJobExclusionModel.get_uri()+pk+"/")
                .then(
                    function(){
                        thNotify.send("Job filter successfully deleted", "success");
                    },
                    function(reason){
                        thNotify.send(reason.data,"danger");
                        return $q.reject(reason);
                    }
                );
        };

        return ThJobExclusionModel;
    }]);
