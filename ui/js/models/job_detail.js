import treeherder from '../treeherder';
import { getRootUrl } from '../../helpers/urlHelper';

treeherder.factory('ThJobDetailModel', [
    '$http', function ($http) {
        return {
            getJobDetails: function (params, config) {
                config = config || {};
                var timeout = config.timeout || null;

                return $http.get(getRootUrl("/jobdetail/"), {
                    params: params,
                    timeout: timeout
                }).then(function (response) {
                    return response.data.results;
                });
            }
        };
    }]);
