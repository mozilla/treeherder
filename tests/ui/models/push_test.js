import fetchMock from 'fetch-mock';

import PushModel from '../../../ui/models/push';
import { getProjectUrl } from '../../../ui/helpers/location';
import {
  thMaxPushFetchSize,
  thMaxPushes,
} from '../../../ui/helpers/constants';

describe('PushModel', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  describe('getList count handling', () => {
    const lastPushUrl = () => {
      const [url] = fetchMock.lastCall();
      return new URL(url, 'http://localhost');
    };

    beforeEach(() => {
      fetchMock.get('begin:/api/project/autoland/push/', { results: [] });
    });

    test('defaults to a count of 10', async () => {
      await PushModel.getList({ repo: 'autoland' });
      expect(lastPushUrl().searchParams.get('count')).toBe('10');
    });

    test('range queries with no explicit count fetch the per-request max', async () => {
      await PushModel.getList({ repo: 'autoland', startdate: '2026-08-01' });
      expect(lastPushUrl().searchParams.get('count')).toBe(
        String(thMaxPushFetchSize),
      );
    });

    test('an explicit count is respected on range queries', async () => {
      await PushModel.getList({
        repo: 'autoland',
        startdate: '2026-08-01',
        count: 20,
      });
      expect(lastPushUrl().searchParams.get('count')).toBe('20');
    });

    test('count never exceeds the overall push ceiling', async () => {
      await PushModel.getList({ repo: 'autoland', count: 5000 });
      expect(lastPushUrl().searchParams.get('count')).toBe(
        String(thMaxPushes),
      );
    });
  });

  describe('taskcluster actions', () => {
    const decisionTaskUrl = getProjectUrl(
      '/push/decisiontask/?push_ids=548880',
      'autoland',
    );
    beforeEach(() => {
      fetchMock.mock(decisionTaskUrl, {
        548880: { id: 'U-lI3jzPTkWFplfJPz6cJA', run: '0' },
      });
    });

    test('getDecisionTaskId', async () => {
      const decisionTaskId = await PushModel.getDecisionTaskId(
        548880,
        () => {},
      );

      expect(decisionTaskId).toStrictEqual({
        id: 'U-lI3jzPTkWFplfJPz6cJA',
        run: '0',
      });
      expect(fetchMock.calls(decisionTaskUrl)).toHaveLength(1);

      await PushModel.getDecisionTaskId(548880, () => {});
      // on second try, it was cached.  So we still have just 1 call
      expect(fetchMock.calls(decisionTaskUrl)).toHaveLength(1);
    });

    test('getDecisionTaskMap', async () => {
      const decisionTaskMap = await PushModel.getDecisionTaskMap(
        [548880],
        () => {},
      );

      expect(decisionTaskMap).toStrictEqual({
        548880: { id: 'U-lI3jzPTkWFplfJPz6cJA', run: '0' },
      });
    });
  });
});
