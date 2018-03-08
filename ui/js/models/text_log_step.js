import treeherder from '../treeherder';
import { getApiUrl } from '../../helpers/urlHelper';

treeherder.factory('ThTextLogStepModel', [
    '$resource', function ($resource) {
        return $resource(getApiUrl('/project/:project/jobs/:jobId/text_log_steps/'));
    }]);
