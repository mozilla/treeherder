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

  describe('retriggering ', () => {
    beforeEach(() => {
      fetchMock.mock(
        getApiUrl('/jobs/?push_id=526443'),
        paginatedJobListFixtureOne,
      );
    });

    test('jobs should have required fields', async () => {
      const { data: jobs } = await JobModel.getList({ push_id: 526443 });
      const { signature, job_type_name } = jobs[0];

      expect(signature).toBe('2aa083621bb989d6acf1151667288d5fe9616178');
      expect(job_type_name).toBe('Gecko Decision Task');
    });
  });
});
