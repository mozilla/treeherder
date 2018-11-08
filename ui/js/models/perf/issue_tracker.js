// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, object-shorthand */
import treeherder from '../../treeherder';
import { getApiUrl } from '../../../helpers/url';

treeherder.factory('PhIssueTracker', [
    '$http', '$q', function ($http, $q) {
        const issueTrackerService = {
            getIssueTrackerList: function () {
                if (this.cachedIssueTrackerList !== null) {
                    return $q.resolve(this.cachedIssueTrackerList);
                    }
                return $http.get(getApiUrl('/performance/issue-tracker/'))
                    .then((response) => {
                        this.cachedIssueTrackerList = response.data;
                        return this.cachedIssueTrackerList;
                });
            },
            cachedIssueTrackerList: null,
        };

        return issueTrackerService;
    }]);
