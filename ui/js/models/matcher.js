'use strict';

treeherder.factory('ThMatcherModel', [
    '$http', '$log', 'thUrl',
    function($http, $log, thUrl) {

        // ThJobTypeModel is the js counterpart of job_type

        var ThMatcherModel = function(data) {
            // creates a new instance of ThJobTypeModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThMatcherModel.get_uri = function(){
            var url = thUrl.getRootUrl("/matcher/");
            return url;
        };

        ThMatcherModel.get_list = function() {
            return matchers;
        };

        ThMatcherModel.by_id = function() {
            return matchers.then((data) =>
                                 data.reduce((matchersById, matcher) =>
                                             matchersById.set(matcher.id, matcher), new Map()));
        };

        ThMatcherModel.get = function(pk) {
            ThMatcherModel.by_id.then((map) => map[pk]);
        };

        var matchers = $http.get(ThMatcherModel.get_uri(), {
            cache: true
        }).then((response) => response.data.map((elem) => new ThMatcherModel(elem)));

        return ThMatcherModel;
    }]);
