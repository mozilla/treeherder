import fetchMock from 'fetch-mock';

import PushModel from '../../../ui/models/push';
import { getProjectUrl } from '../../../ui/helpers/location';

describe('PushModel', () => {
  afterEach(() => {
    fetchMock.reset();
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
