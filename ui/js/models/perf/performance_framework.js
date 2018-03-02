import treeherder from '../../treeherder';

treeherder.factory(
    'PhFramework', [
        '$http',
        function ($http) {
            return {
                getFrameworkList: function () {
                    return $http.get(`${SERVICE_DOMAIN}/api/performance/framework/`)
                      .then(function (response) {
                        return response.data;
                      });
                }
            };
        }]);
