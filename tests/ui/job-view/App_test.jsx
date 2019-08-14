import React from 'react';
import { fetchMock } from 'fetch-mock';
import { render, cleanup, waitForElement } from '@testing-library/react';

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
      getProjectUrl('/push/?full=true&count=10', repoName),
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
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, {
      results: [],
      meta: { repository: repoName, offset: 0, count: 2000 },
    });
  });

  afterAll(() => cleanup);

  test('changing repo updates ``currentRepo``', async () => {
    setUrlParam('repo', repoName);
    const { getByText } = render(<App />);
    const revisionDefault = await waitForElement(() =>
      getByText('ba9c692786e9'),
    );

    expect(revisionDefault).toBeInTheDocument();

    setUrlParam('repo', 'try');
    await waitForElement(() => getByText('333333333333'));

    expect(document.querySelector('.revision a').getAttribute('href')).toBe(
      'https://hg.mozilla.org/try/rev/3333333333335143b8df3f4b3e9b504dfbc589a0',
    );
  });
});
