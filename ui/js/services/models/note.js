'use strict';

treeherder.factory('ThJobNoteModel', ['$http', '$log', 'thUrl', function($http, $log, thUrl) {
    // ThJobNoteModel is the js counterpart of note

    var ThJobNoteModel = function(data) {
        // creates a new instance of ThJobArtifactModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobNoteModel.get_uri = function(){return thUrl.getProjectUrl("/note/");};

    ThJobNoteModel.get_list = function(options) {
        // a static method to retrieve a list of ThJobNoteModel
        var query_string = $.param(options);
        return $http.get(ThJobNoteModel.get_uri()+"?"+query_string)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobNoteModel(elem));
                });
                return item_list;
        });
    };

    ThJobNoteModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobNoteModel
        return $http.get(ThJobNoteModel.get_uri()+pk).then(function(response) {
            return new ThJobNoteModel(response.data);
        });
    };

    // an instance method to create a new ThJobNoteModel
    ThJobNoteModel.prototype.create = function() {
        var note = this;
        return $http.post(ThJobNoteModel.get_uri(), note);
    };

    // an instance method to delete a ThJobNoteModel object
    ThJobNoteModel.prototype.delete = function(){
        return $http.delete(ThJobNoteModel.get_uri()+this.id);
    };

    return ThJobNoteModel;
}]);
