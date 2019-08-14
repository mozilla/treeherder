import { fetchMock } from 'fetch-mock';

import JobModel from '../../../ui/models/job';
import { getApiUrl } from '../../../ui/helpers/url';
import paginatedJobListFixtureOne from '../mock/job_list/pagination/page_1';
import paginatedJobListFixtureTwo from '../mock/job_list/pagination/page_2';

describe('JobModel', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  describe('pagination', () => {
    beforeEach(() => {
      fetchMock.mock(getApiUrl('/jobs/?count=2'), paginatedJobListFixtureOne);
      fetchMock.mock(
        getApiUrl('/jobs/?push_id=526443'),
        paginatedJobListFixtureOne,
      );
      fetchMock.mock(
        getApiUrl('/jobs/?push_id=526443&page=2'),
        paginatedJobListFixtureTwo,
      );
    });

    test('should return a page of results by default', async () => {
      const { data } = await JobModel.getList({ count: 2 });

      expect(data).toHaveLength(2);
    });

    test('should return all the pages when fetchAll==true', async () => {
      const { data } = await JobModel.getList(
        { push_id: 526443 },
        { fetchAll: true },
      );

      expect(data).toHaveLength(3);
      expect(data[2].id).toBe(259539688);
    });
  });
});
