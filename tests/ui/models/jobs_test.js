import fetchMock from 'fetch-mock';

import JobModel from '../../../ui/models/job';
import { decisionTaskIdCache } from '../../../ui/models/push';
import { getApiUrl } from '../../../ui/helpers/url';
import paginatedJobListFixtureOne from '../mock/job_list/pagination/page_1';
import paginatedJobListFixtureTwo from '../mock/job_list/pagination/page_2';
import repositories from '../mock/repositories';
import { getProjectUrl } from '../../../ui/helpers/location';

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

  describe('Taskcluster actions', () => {
    // TODO change to firefox-ci
    const rootUrl = 'https://firefox-ci-tc.services.mozilla.com';
    const decisionTaskMap = {
      '526443': { id: 'LVTawdmFR2-uJiWWS2NxSw', run: '0' },
    };

    const tcActionsUrl = `${rootUrl}/api/queue/v1/task/LVTawdmFR2-uJiWWS2NxSw/artifacts/public%2Factions.json`;
    const tcTaskUrl = `${rootUrl}/api/queue/v1/task/TASKID`;
    const decisionTaskMapUrl = getProjectUrl(
      '/push/decisiontask/?push_ids=526443',
      'autoland',
    );
    const notify = () => {};
    const testJobs = [
      { id: 123, push_id: 526443, job_type_name: 'foo', task_id: 'TASKID' },
    ];
    const currentRepo = repositories[2];

    beforeEach(() => {
      fetchMock.mock(
        getApiUrl('/jobs/?push_id=526443'),
        paginatedJobListFixtureOne,
      );
      fetchMock.mock(
        getApiUrl('/taskclustermetadata/?job_ids=123'),
        paginatedJobListFixtureOne,
      );
      fetchMock.mock(decisionTaskMapUrl, decisionTaskMap);
      fetchMock.get(tcActionsUrl, { version: 1, actions: [{ name: 'foo' }] });
      fetchMock.get(tcTaskUrl, {});

      // Must clear the cache, because we save each time we
      // call the API for a decision task id.
      Object.keys(decisionTaskIdCache).forEach(
        prop => delete decisionTaskIdCache[prop],
      );
    });

    test('jobs should have required fields', async () => {
      const { data: jobs } = await JobModel.getList({ push_id: 526443 });
      const { signature, job_type_name: jobTypeName } = jobs[0];

      expect(signature).toBe('2aa083621bb989d6acf1151667288d5fe9616178');
      expect(jobTypeName).toBe('Gecko Decision Task');
    });

    test('retrigger uses passed-in decisionTaskMap', async () => {
      await JobModel.retrigger(
        testJobs,
        currentRepo,
        notify,
        1,
        decisionTaskMap,
        true,
      );

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(false);
      expect(fetchMock.called(tcTaskUrl)).toBe(false);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });

    test('retrigger calls for decision task when not passed-in', async () => {
      await JobModel.retrigger(testJobs, currentRepo, notify, 1, null, true);

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(true);
      expect(fetchMock.called(tcTaskUrl)).toBe(false);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });

    test('cancel uses passed-in decisionTask', async () => {
      await JobModel.cancel(
        testJobs,
        currentRepo,
        () => {},
        decisionTaskMap,
        true,
      );

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(false);
      expect(fetchMock.called(tcTaskUrl)).toBe(true);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });

    test('cancel calls for decision task when not passed-in', async () => {
      await JobModel.cancel(testJobs, currentRepo, () => {}, null, true);

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(true);
      expect(fetchMock.called(tcTaskUrl)).toBe(true);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });

    test('cancelAll uses passed-in decisionTask', async () => {
      const decisionTask = { id: 'LVTawdmFR2-uJiWWS2NxSw', run: '0' };

      await JobModel.cancelAll(
        526443,
        currentRepo,
        () => {},
        decisionTask,
        true,
      );

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(false);
      expect(fetchMock.called(tcTaskUrl)).toBe(false);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });

    test('cancelAll calls for decision task when not passed-in', async () => {
      await JobModel.cancelAll(526443, currentRepo, () => {}, null, true);

      expect(fetchMock.called(decisionTaskMapUrl)).toBe(true);
      expect(fetchMock.called(tcTaskUrl)).toBe(false);
      expect(fetchMock.called(tcActionsUrl)).toBe(true);
    });
  });
});
