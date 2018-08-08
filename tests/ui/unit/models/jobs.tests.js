import * as fetchMock from 'fetch-mock';

import JobModel from '../../../../ui/models/job';
import { getProjectUrl } from '../../../../ui/helpers/url';

describe('JobModel', () => {
  const repoName = 'mozilla-inbound';

  beforeEach(() => {
    jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';
  });

  afterEach(() => {
    fetchMock.restore();
  });

  describe('getList', () => {
    beforeEach(() => {
      fetchMock.get(getProjectUrl('/jobs/'), getJSONFixture('job_list/job_1.json'));
    });

    it('should return a promise', () => {
      const result = JobModel.getList('mozilla-inbound');
      expect(result.then).toBeDefined();
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      fetchMock.get(getProjectUrl('/jobs/?count=2'), getJSONFixture('job_list/pagination/page_1.json'));
      fetchMock.get(getProjectUrl('/jobs/?count=2&offset=2'), getJSONFixture('job_list/pagination/page_2.json'));
    });

    it('should return a page of results by default', async () => {
      const jobList = await JobModel.getList(repoName, { count: 2 });

      expect(jobList.length).toBe(2);
    });

    it('should return all the pages when fetch_all==true', async () => {
      const jobList = await JobModel.getList(repoName, { count: 2 }, { fetch_all: true });

      expect(jobList.length).toBe(3);
      expect(jobList[2].id).toBe(3);
    });
  });
});
