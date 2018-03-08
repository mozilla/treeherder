import treeherder from '../treeherder';
import { getApiUrl } from '../../helpers/urlHelper';

treeherder.factory('ThBugSuggestionsModel', [
    '$resource', function ($resource) {
        return $resource(getApiUrl('/project/:project/jobs/:jobId/bug_suggestions/'));
    }]);
