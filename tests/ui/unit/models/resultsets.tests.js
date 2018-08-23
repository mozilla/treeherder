import * as fetchMock from 'fetch-mock';

import { getProjectUrl } from '../../../../ui/helpers/url';

describe('ThResultSetStore', () => {

    let model;
    const repoName = 'mozilla-inbound';

    beforeEach(angular.mock.module('treeherder'));

    beforeEach(inject((ThResultSetStore) => {

        jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';

        fetchMock.get(getProjectUrl('/resultset/?full=true&count=10', repoName),
            getJSONFixture('push_list.json'),
        );

        fetchMock.get(
          getProjectUrl('/jobs/?return_type=list&count=2000&result_set_id=1', repoName),
          getJSONFixture('job_list/job_1.json'),
        );

        fetchMock.get(
          getProjectUrl('/jobs/?return_type=list&count=2000&result_set_id=2', repoName),
          getJSONFixture('job_list/job_2.json'),
        );

        model = ThResultSetStore;
        model.initRepository(repoName);
    }));

    afterEach(() => {
      fetchMock.restore();
    });

    /*
        Tests ThResultSetStore
     */
    it('should have 2 resultset', async () => {
        await model.fetchPushes(10);
        expect(model.getPushArray().length).toBe(2);
    });

    it('should have id of 1 in current repo', async () => {
        await model.fetchPushes(10);
        expect(model.getPushArray()[0].id).toBe(1);
    });
});
