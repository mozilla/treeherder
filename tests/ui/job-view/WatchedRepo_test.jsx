import fetchMock from 'fetch-mock';
import { render, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import WatchedRepo from '../../../ui/job-view/headerbars/WatchedRepo';

const treeStatusUrl = 'https://lando.moz.tools/api/treestatus/trees';

const gitRepo = {
  id: 148,
  name: 'firefox-dev',
  dvcs_type: 'git',
  url: 'https://github.com/mozilla-firefox/firefox-dev',
  active_status: 'active',
  codebase: 'gecko',
  repository_group: { name: 'development', description: '' },
};

afterEach(() => {
  fetchMock.reset();
});

const renderWatchedRepo = (repo, setCurrentRepoTreeStatus = () => {}) =>
  render(
    <MemoryRouter initialEntries={[`/jobs?repo=${repo.name}`]}>
      <WatchedRepo
        repoName={repo.name}
        unwatchRepo={() => {}}
        repo={repo}
        setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
      />
    </MemoryRouter>,
  );

describe('WatchedRepo', () => {
  test('should fetch the tree status of a git repo', async () => {
    fetchMock.get(`${treeStatusUrl}/firefox-dev`, {
      result: {
        message_of_the_day: '',
        reason: 'maintenance',
        status: 'closed',
        tree: 'firefox-dev',
      },
    });
    const setCurrentRepoTreeStatus = jest.fn();

    renderWatchedRepo(gitRepo, setCurrentRepoTreeStatus);

    await waitFor(() => {
      expect(screen.getByTitle('closed')).toBeInTheDocument();
    });
    expect(setCurrentRepoTreeStatus).toHaveBeenCalledWith('closed');
  });

  test('should show a repo missing from Tree Status as unsupported', async () => {
    fetchMock.get(`${treeStatusUrl}/firefox-dev`, 404);
    const setCurrentRepoTreeStatus = jest.fn();

    renderWatchedRepo(gitRepo, setCurrentRepoTreeStatus);

    await waitFor(() => {
      expect(screen.getByTitle('unsupported')).toBeInTheDocument();
    });
    expect(setCurrentRepoTreeStatus).toHaveBeenCalledWith('unsupported');
  });
});
