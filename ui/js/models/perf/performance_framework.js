import treeherder from '../../treeherder';
import { getApiUrl } from "../../../helpers/urlHelper";

treeherder.factory(
    'PhFramework', [
        '$http',
        function ($http) {
            return {
                getFrameworkList: function () {
                    return $http.get(getApiUrl('/performance/framework/'))
                      .then(function (response) {
                        return response.data;
                      });
                }
            };
        }]);
