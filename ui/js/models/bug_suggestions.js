import treeherder from '../treeherder';
import { getRootUrl } from '../../helpers/urlHelper';

treeherder.factory('ThBugSuggestionsModel', [
    '$resource', function ($resource) {
        return $resource(getRootUrl('/project/:project/jobs/:jobId/bug_suggestions/'));
    }]);
