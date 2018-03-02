import treeherder from '../treeherder';
import { getRootUrl } from '../../helpers/urlHelper';

treeherder.factory('ThTextLogStepModel', [
    '$resource', function ($resource) {
        return $resource(getRootUrl('/project/:project/jobs/:jobId/text_log_steps/'));
    }]);
