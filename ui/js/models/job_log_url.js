'use strict';

treeherder.factory('ThJobLogUrlModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

    // ThJobLogUrlModel is the js counterpart of job_type

    var ThJobLogUrlModelModel = function(data) {
        // creates a new instance of ThJobLogUrlModelModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobLogUrlModelModel.get_uri = function(){
        var url = thUrl.getProjectUrl("/job-log-url/");
        $log.log(url);
        return url;
    };

    ThJobLogUrlModelModel.get_list = function(job_id) {
        // a static method to retrieve a list of ThJobLogUrlModelModel
        return $http.get(ThJobLogUrlModelModel.get_uri()+"?job_id="+job_id)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    item_list.push(new ThJobLogUrlModelModel(elem));
                });
                return item_list;
        });
    };

    ThJobLogUrlModelModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobLogUrlModelModel
        return $http.get(ThJobLogUrlModelModel.get_uri()+pk).then(function(response) {
            return new ThJobLogUrlModelModel(response.data);
        });
    };

    return ThJobLogUrlModelModel;
}]);
