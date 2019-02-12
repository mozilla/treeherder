import { fetchMock } from 'fetch-mock';

import JobModel from '../../../../ui/models/job';
import { getProjectUrl } from '../../../../ui/helpers/location';
import jobListFixtureOne from '../../mock/job_list/job_1';
import paginatedJobListFixtureOne from '../../mock/job_list/pagination/page_1';
import paginatedJobListFixtureTwo from '../../mock/job_list/pagination/page_2';

describe('JobModel', () => {
  const repoName = 'mozilla-inbound';

  afterEach(() => {
    fetchMock.reset();
  });

  describe('getList', () => {
    beforeEach(() => {
      fetchMock.mock(getProjectUrl('/jobs/'), jobListFixtureOne);
    });

    test('should return a promise', () => {
      const result = JobModel.getList('mozilla-inbound');
      expect(result.then).toBeDefined();
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      fetchMock.mock(
        getProjectUrl('/jobs/?count=2'),
        paginatedJobListFixtureOne,
      );
      fetchMock.mock(
        getProjectUrl('/jobs/?count=2&offset=2'),
        paginatedJobListFixtureTwo,
      );
    });

    test('should return a page of results by default', async () => {
      const jobList = await JobModel.getList(repoName, { count: 2 });

      expect(jobList).toHaveLength(2);
    });

    test('should return all the pages when fetch_all==true', async () => {
      const jobList = await JobModel.getList(
        repoName,
        { count: 2 },
        { fetch_all: true },
      );

      expect(jobList).toHaveLength(3);
      expect(jobList[2].id).toBe(3);
    });
  });
});
