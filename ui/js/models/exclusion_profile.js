'use strict';

treeherder.factory('ThExclusionProfileModel', [
    '$http', '$log', 'thUrl', '$q', 'thNotify',
    function($http, $log, thUrl, $q, thNotify) {

        // ThExclusionProfileModel is the js counterpart of Exclusion Profile

        var ThExclusionProfileModel = function(data) {
            // creates a new instance of ThExclusionProfileModel
            // using the provided properties
            return angular.extend(this, data);
        };

        ThExclusionProfileModel.get_uri = function(){
            return thUrl.getRootUrl("/exclusion-profile/");
        };

        ThExclusionProfileModel.get_list = function(options, cache) {
            // a static method to retrieve a list of ThExclusionProfileModel
            options = options || {};
            cache = cache || false;
            var query_string = $.param(options);
            return $http.get(ThExclusionProfileModel.get_uri()+"?"+query_string,{
                cache: cache
            })
                .then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThExclusionProfileModel(elem));
                    });
                    return item_list;
                });
        };

        ThExclusionProfileModel.get = function(pk) {
            // a static method to retrieve a single instance of ThExclusionProfileModel
            return $http.get(ThExclusionProfileModel.get_uri()+pk).then(function(response) {
                return new ThExclusionProfileModel(response.data);
            });
        };

        // an instance method to create a new ThExclusionProfileModel
        ThExclusionProfileModel.prototype.create = function() {
            var exclusion_profile = this;
            return $http.post(ThExclusionProfileModel.get_uri(), exclusion_profile)
                .then(
                    function(response){
                        angular.extend(exclusion_profile, response.data);
                        $log.debug(exclusion_profile);
                        thNotify.send("Exclusion profile successfully created", "success");
                    },
                    function(reason){
                        if (reason.status === 400) {
                            angular.forEach(reason.data, function(error_list, field){
                                angular.forEach(error_list, function(error){
                                    thNotify.send(field+": "+error, "danger");
                                });
                            });
                        } else if (reason.data && reason.data.detail) {
                            thNotify.send(reason.data.detail, "danger");
                        } else {
                            thNotify.send("Error","danger");
                            $log.error(reason);
                        }
                        return $q.reject(reason);
                    }
                );
        };

        // an instance method to create a new ThExclusionProfileModel
        ThExclusionProfileModel.prototype.update = function() {
            var exclusion_profile = this;
            return $http.put(
                ThExclusionProfileModel.get_uri()+exclusion_profile.id+"/",
                exclusion_profile
            )
                .then(
                    function(){
                        thNotify.send("Exclusion profile successfully updated", "success");
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

        // an instance method to delete a ThExclusionProfileModel object
        ThExclusionProfileModel.prototype.delete = function(){
            $log.debug(this);
            var pk = this.id;
            return $http.delete(ThExclusionProfileModel.get_uri()+pk+"/")
                .then(
                    function(){
                        thNotify.send("Exclusion profile successfully deleted", "success");
                    },
                    function(reason){
                        thNotify.send(reason.data,"danger");
                        return $q.reject(reason);
                    }
                );
        };

        return ThExclusionProfileModel;
    }]);
