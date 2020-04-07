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
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ZmoRedHAS56x-v4x8ZCARA/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 'reference',
            name: 'public/logs/live.log',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/plain; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/R6PG57o6SvaubJl7IMUy3A/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/logs/live_backing.log',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/plain; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ZcxHIe_pQweTuRjFA-849w/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/logs/localconfig.json',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'application/octet-stream',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/AksxU4n9Q1aPituH1GSCKw/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/test_info/report.html',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/html; charset=utf-8',
          },
          {
            storageType: 's3',
            name: 'public/test_info/report.xml',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/xml; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/GSWobW08RayRuWsYtz9awA/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/test_info/resource-usage.json',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'application/octet-stream',
          },
        ],
      },
    );
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
