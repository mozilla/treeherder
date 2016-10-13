"use strict";

treeherder.factory('ThBugSuggestionsModel', [
    '$resource', 'thUrl', function($resource, thUrl) {
        return $resource(thUrl.getRootUrl('/project/:project/jobs/:jobId/bug_suggestions/'));
    }]);
