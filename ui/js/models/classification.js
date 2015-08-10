'use strict';

treeherder.factory('ThJobClassificationModel', [
    '$http', 'ThLog', 'thUrl',
    function($http, ThLog, thUrl) {

        // ThJobClassificationModel is the js counterpart of note

        var ThJobClassificationModel = function(data) {
            // creates a new instance of ThJobClassificationModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThJobClassificationModel.get_uri = function(){return thUrl.getProjectUrl("/note/");};

        ThJobClassificationModel.get_list = function(options) {
            // a static method to retrieve a list of ThJobClassificationModel
            var query_string = $.param(options);
            return $http.get(ThJobClassificationModel.get_uri()+"?"+query_string)
                .then(function(response) {
                    var item_list = [];
                    angular.forEach(response.data, function(elem){
                        item_list.push(new ThJobClassificationModel(elem));
                    });
                    return item_list;
                });
        };

        ThJobClassificationModel.get = function(pk) {
            // a static method to retrieve a single instance of ThJobClassificationModel
            return $http.get(ThJobClassificationModel.get_uri()+pk).then(function(response) {
                return new ThJobClassificationModel(response.data);
            });
        };

        // an instance method to create a new ThJobClassificationModel
        ThJobClassificationModel.prototype.create = function() {
            var note = this;
            return $http.post(ThJobClassificationModel.get_uri(), note);
        };

        // an instance method to delete a ThJobClassificationModel object
        ThJobClassificationModel.prototype.delete = function(){
            return $http.delete(ThJobClassificationModel.get_uri()+this.id+"/");
        };

        return ThJobClassificationModel;
    }]);
