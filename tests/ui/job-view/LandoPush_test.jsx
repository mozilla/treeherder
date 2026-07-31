/**
 * Integration test for the display of a lando landing job that has no push
 * yet: only the lando instances returning the commits of the landing job get
 * the push-like display, the other ones keep the plain waiting message.
 */

import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRoutes } from '../../../ui/App';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';

const landoUrl = 'https://lando.moz.tools/landing_jobs/72544';
const landingJob = {
  commit_id: '',
  created_at: '2026-07-28T17:22:11.721Z',
  error: '',
  id: 72544,
  requester: 'fqueze@mozilla.com',
  status: 'SUBMITTED',
  repository: 'try',
  revisions: [
    {
      author_email: 'florian@queze.net',
      author_name: 'Florian Quèze',
      commit_message: 'Bug 2052432 - Log minidump sizes, r=ahal.',
      url: 'https://lando.moz.tools/landings/72544#r177716',
    },
  ],
  url: 'https://lando.moz.tools/landings/72544',
};

const jobsUrl =
  '/jobs?repo=try&landoInstance=lando-prod-2025&landoCommitID=72544';

const renderLandingJob = (job) => {
  fetchMock.get(landoUrl, job, { overwriteRoutes: true });
  // The url params are read from the location, not from the router.
  window.history.pushState({}, '', jobsUrl);

  return render(
    <MemoryRouter initialEntries={[jobsUrl]}>
      <AppRoutes />
    </MemoryRouter>,
  );
};

describe('Lando push', () => {
  beforeAll(() => {
    // ui/App.jsx sets the favicon on this link.
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    document.querySelector('head').appendChild(link);

    fetchMock.get(
      'begin:https://treestatus.prod.lando.prod.cloudops.mozgcp.net/trees/',
      { result: { message_of_the_day: '', reason: '', status: 'open' } },
    );
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/performance/framework/'), {});
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(`begin:${getProjectUrl('/push/?full=true&count=', 'try')}`, {
      results: [],
    });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  it('shows the commits when lando returns them', async () => {
    renderLandingJob(landingJob);

    expect(
      await screen.findByText(/Log minidump sizes, r=ahal./),
    ).toBeInTheDocument();
    expect(screen.getByText(/fqueze@mozilla.com/)).toBeInTheDocument();
  });

  it('shows the waiting message when lando returns no commit', async () => {
    renderLandingJob({ ...landingJob, revisions: [] });

    expect(
      await screen.findByText(/Waiting for push with lando commit ID/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lando-push')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(/Lando status is: submitted/),
      ).toBeInTheDocument(),
    );
  });
});
