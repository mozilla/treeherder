import angular from 'angular';

import treeherder from '../treeherder';
import { getRootUrl } from '../../helpers/urlHelper';

treeherder.factory('ThMatcherModel', [
    '$http',
    function ($http) {

        // ThJobTypeModel is the js counterpart of job_type

        const ThMatcherModel = function (data) {
            // creates a new instance of ThJobTypeModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThMatcherModel.get_uri = function () {
            const url = getRootUrl("/matcher/");
            return url;
        };

        const matchers = $http
                .get(ThMatcherModel.get_uri(), {
                    cache: true
                })
                .then(response => response.data.map(elem => new ThMatcherModel(elem)));

        ThMatcherModel.get_list = function () {
            return matchers;
        };

        ThMatcherModel.by_id = function () {
            return matchers.then(data =>
                                 data.reduce((matchersById, matcher) =>
                                             matchersById.set(matcher.id, matcher), new Map()));
        };

        ThMatcherModel.get = function (pk) {
            ThMatcherModel.by_id.then(map => map[pk]);
        };

        return ThMatcherModel;
    }]);
