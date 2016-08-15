'use strict';

treeherder.factory('ThUserModel', [
    '$http', '$log', 'thUrl', 'thNotify', '$q',
    function($http, $log, thUrl, thNotify, $q) {

        // ThUserModel is the js counterpart of user

        var ThUserModel = function(data) {
            // creates a new instance of ThUserModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThUserModel.get_uri = function(){return thUrl.getRootUrl("/user/");};

        ThUserModel.get = function() {
            // a static method to retrieve a single instance of ThUserModel
            // the primary key should be an email
            return $http.get(ThUserModel.get_uri()).then(
                function(response) {
                    return (response.data.length > 0) ? new ThUserModel(response.data[0]) : {};
                },
                function(reason){
                    thNotify.send(reason.data,"danger");
                    return $q.reject(reason);
                });
        };

        return ThUserModel;
    }]);
