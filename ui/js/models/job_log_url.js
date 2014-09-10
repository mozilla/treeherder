'use strict';

treeherder.factory('ThJobLogUrlModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

    // ThJobLogUrlModel is the js counterpart of job_type

    var ThJobLogUrlModel = function(data) {
        // creates a new instance of ThJobLogUrlModel
        // using the provided properties
        angular.extend(this, data);
    };

    ThJobLogUrlModel.get_uri = function(){
        var url = thUrl.getProjectUrl("/job-log-url/");
        $log.log(url);
        return url;
    };

    ThJobLogUrlModel.get_list = function(job_id) {
        // a static method to retrieve a list of ThJobLogUrlModel
        return $http.get(ThJobLogUrlModel.get_uri()+"?job_id="+job_id)
            .then(function(response) {
                var item_list = [];
                angular.forEach(response.data, function(elem){
                    var buildData = elem.url.split('/');
                    var buildUrl = elem.url.slice(0, elem.url.lastIndexOf('/')) + "/"
                    elem.buildUrl = buildUrl;
                    item_list.push(new ThJobLogUrlModel(elem));
                });
                return item_list;
        });
    };

    ThJobLogUrlModel.get = function(pk) {
        // a static method to retrieve a single instance of ThJobLogUrlModel
        return $http.get(ThJobLogUrlModel.get_uri()+pk).then(function(response) {
            return new ThJobLogUrlModel(response.data);
        });
    };

    return ThJobLogUrlModel;
}]);
