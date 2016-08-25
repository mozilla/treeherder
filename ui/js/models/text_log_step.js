'use strict';

treeherder.factory('ThTextLogStepModel', [
    '$resource', 'thUrl', function($resource, thUrl) {
        return $resource(thUrl.getRootUrl('/project/:project/jobs/:jobId/text_log_steps/'));
    }]);
