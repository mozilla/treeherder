import React from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  waitForElement,
  getAllByTestId,
  queryAllByTestId,
} from '@testing-library/react';

import Health from '../../../ui/push-health/Health';
import pushHealth from '../mock/push_health';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';

const revision = 'cd02b96bdce57d9ae53b632ca4740c871d3ecc32';
const repo = 'autoland';

describe('Health', () => {
  beforeAll(() => {
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/jobdetail/?job_id=285852375'), {
      results: [{ id: 285854763, value: 'foo' }],
    });
    fetchMock.get(getApiUrl('/jobdetail/?job_id=285854757'), {
      results: [{ id: 285854763, value: 'foo' }],
    });
    fetchMock.get(getApiUrl('/jobdetail/?job_id=285854763'), {
      results: [{ id: 285854763, value: 'foo' }],
    });
    fetchMock.get(getApiUrl('/jobdetail/?job_id=285867234'), {
      results: [{ id: 285854763, value: 'foo' }],
    });
    fetchMock.get(getApiUrl('/jobdetail/?job_id=285871267'), {
      results: [{ id: 285854763, value: 'foo' }],
    });
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(
      getProjectUrl(
        '/push/health/?revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
        repo,
      ),
      pushHealth,
    );
    fetchMock.get(
      getProjectUrl(
        '/push/health_summary/?revision=eeb6fd68c0223a72d8714734a34d3e6da69995e1',
        repo,
      ),
      [],
    );
  });

  afterAll(() => {
    fetchMock.reset();
    cleanup();
  });

  const testHealth = () => <Health location={window.location} />;

  test('should show some grouped tests', async () => {
    window.history.replaceState(
      {},
      'Push Health Test',
      `${window.location.origin}?repo=${repo}&revision=${revision}`,
    );

    const health = render(testHealth());
    const classificationGroups = await waitForElement(() =>
      health.getAllByTestId('classification-group'),
    );
    const needInvestigationGroups = getAllByTestId(
      classificationGroups[0],
      'test-grouping',
    );
    const intermittentGroups = getAllByTestId(
      classificationGroups[1],
      'test-grouping',
    );

    expect(needInvestigationGroups).toHaveLength(2);
    expect(intermittentGroups).toHaveLength(39);
  });

  test('should filter groups by test path string', async () => {
    window.history.replaceState(
      {},
      'Push Health Test',
      `${window.location.origin}?repo=${repo}&revision=${revision}&searchStr=browser/extensions/`,
    );
    const health = render(testHealth());
    const classificationGroups = await waitForElement(() =>
      health.getAllByTestId('classification-group'),
    );

    expect(
      queryAllByTestId(classificationGroups[0], 'test-grouping'),
    ).toHaveLength(0);
    expect(
      queryAllByTestId(classificationGroups[1], 'test-grouping'),
    ).toHaveLength(2);
  });
});
