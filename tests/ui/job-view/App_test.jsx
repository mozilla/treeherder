import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent } from '@testing-library/react';

import App from '../../../ui/job-view/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl, setUrlParam } from '../../../ui/helpers/location';

describe('App', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get('begin:https://treestatus.mozilla-releng.net/trees/', {
      result: {
        message_of_the_day: '',
        reason: '',
        status: 'open',
        tree: repoName,
      },
    });

    fetchMock.get(
      `begin:${getProjectUrl('/push/?full=true&count=', repoName)}`,
      pushListFixture,
    );
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', 'try'), {
      results: [
        {
          id: 111111,
          revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
          author: 'whozat@gmail.com',
          revision_count: 1,
          push_timestamp: 1562867957,
          repository_id: 4,
          revisions: [
            {
              repository_id: 4,
              revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
              author: 'whozat <whozat@gmail.com>',
              comments: 'didathing',
            },
          ],
        },
      ],
    });
    fetchMock.get(
      `begin:${getProjectUrl(
        '/push/?full=true&count=11&push_timestamp',
        'try',
      )}`,
      {
        results: [],
      },
    );
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, {
      results: [],
      meta: { repository: repoName, offset: 0, count: 2000 },
    });
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );
    fetchMock.get(
      'https://bugzilla.mozilla.org/rest/bug?id=1556854%2C1555861%2C1559418%2C1563766%2C1561537%2C1563692',
      {
        bugs: [],
      },
    );

    // Need to mock this function for the app switching tests.
    // Source: https://github.com/mui-org/material-ui/issues/15726#issuecomment-493124813
    document.createRange = () => ({
      setStart: () => {},
      setEnd: () => {},
      commonAncestorContainer: {
        nodeName: 'BODY',
        ownerDocument: document,
      },
    });
  });

  test('changing repo updates ``currentRepo``', async () => {
    setUrlParam('repo', repoName);
    const { getByText } = render(<App />);

    await waitFor(() => expect(getByText('fb66bad25e85')).toBeInTheDocument());

    setUrlParam('repo', 'try');
    await waitFor(() => getByText('333333333333'));

    expect(document.querySelector('.revision a').getAttribute('href')).toBe(
      'https://hg.mozilla.org/try/rev/3333333333335143b8df3f4b3e9b504dfbc589a0',
    );
  });

  test('should have links to Perfherder and Intermittent Failures View', async () => {
    const { getByText, getByAltText } = render(<App />);
    const appMenu = await waitFor(() => getByAltText('Treeherder'));

    expect(appMenu).toBeInTheDocument();
    fireEvent.click(appMenu);

    const phMenu = await waitFor(() => getByText('Perfherder'));
    expect(phMenu.getAttribute('href')).toBe('/perf.html');

    const ifvMenu = await waitFor(() =>
      getByText('Intermittent Failures View'),
    );
    expect(ifvMenu.getAttribute('href')).toBe('/intermittent-failures.html');
  });
});
