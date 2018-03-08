import treeherder from '../treeherder';
import { getApiUrl } from '../../helpers/urlHelper';

treeherder.factory('ThJobDetailModel', [
    '$http', function ($http) {
        return {
            getJobDetails: function (params, config) {
                config = config || {};
                const timeout = config.timeout || null;

                return $http.get(getApiUrl("/jobdetail/"), {
                    params: params,
                    timeout: timeout
                }).then(function (response) {
                    return response.data.results;
                });
            }
        };
    }]);
