import { fetchMock } from 'fetch-mock';

import PushModel from '../../../ui/models/push';
import { getProjectUrl } from '../../../ui/helpers/location';

describe('PushModel', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  describe('taskcluster actions', () => {
    beforeEach(() => {
      fetchMock.mock(
        getProjectUrl('/push/decisiontask/?push_ids=548880', 'autoland'),
        { '548880': { id: 'U-lI3jzPTkWFplfJPz6cJA', run: '0' } },
      );
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
    });

    test('getDecisionTaskMap', async () => {
      const decisionTaskMap = await PushModel.getDecisionTaskMap(
        [548880],
        () => {},
      );

      expect(decisionTaskMap).toStrictEqual({
        '548880': { id: 'U-lI3jzPTkWFplfJPz6cJA', run: '0' },
      });
    });
  });
});
