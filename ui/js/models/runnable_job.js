'use strict';

treeherder.factory('ThRunnableJobModel', [
    'thUrl', 'ThJobModel',
    function(thUrl, ThJobModel) {
        var ThRunnableJobModel = function(data) {
            angular.extend(this, data);
        };

        ThRunnableJobModel.get_runnable_uri = function(repoName) {
            return thUrl.getProjectUrl("/runnable_jobs/", repoName);
        };

        ThRunnableJobModel.get_list = function(repoName) {
            return ThJobModel.get_list_by_uri(ThRunnableJobModel.get_runnable_uri(repoName));
        };

        return ThRunnableJobModel;
    }]);
