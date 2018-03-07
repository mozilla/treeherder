import angular from 'angular';

import treeherder from '../treeherder';
import { getProjectUrl } from "../../helpers/urlHelper";

treeherder.factory('ThJobLogUrlModel', [
    '$http',
    function ($http) {

        // ThJobLogUrlModel is the js counterpart of job_type

        const ThJobLogUrlModel = function (data) {
            // creates a new instance of ThJobLogUrlModel
            // using the provided properties
            angular.extend(this, data);
        };

        ThJobLogUrlModel.get_uri = function () {
            const url = getProjectUrl("/job-log-url/");
            return url;
        };

        ThJobLogUrlModel.get_list = function (job_id, config) {
            // a static method to retrieve a list of ThJobLogUrlModel
            config = config || {};
            const timeout = config.timeout || null;

            const params = { job_id: job_id };
            return $http.get(ThJobLogUrlModel.get_uri(), {
                params: params,
                timeout: timeout
            })
                .then(function (response) {
                    const item_list = [];
                    angular.forEach(response.data, function (elem) {
                        const buildUrl = elem.url.slice(0, elem.url.lastIndexOf("/")) + "/";
                        elem.buildUrl = buildUrl;
                        item_list.push(new ThJobLogUrlModel(elem));
                    });
                    return item_list;
                });
        };

        ThJobLogUrlModel.get = function (pk) {
            // a static method to retrieve a single instance of ThJobLogUrlModel
            return $http.get(ThJobLogUrlModel.get_uri()+pk+"/").then(function (response) {
                return new ThJobLogUrlModel(response.data);
            });
        };

        return ThJobLogUrlModel;
    }]);
