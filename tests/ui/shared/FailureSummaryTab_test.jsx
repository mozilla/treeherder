import React from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import { createBrowserHistory } from 'history';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';

import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import PinBoard from '../../../ui/job-view/details/PinBoard';
import { addBug } from '../../../ui/job-view/redux/stores/pinnedJobs';
import FailureSummaryTab from '../../../ui/shared/tabs/failureSummary/FailureSummaryTab';
import jobMap from '../mock/job_map';
import bugSuggestions from '../mock/bug_suggestions.json';
import jobLogUrls from '../mock/job_log_urls.json';
import repositories from '../mock/repositories.json';
import { configureStore } from '../../../ui/job-view/redux/configureStore';

const selectedJob = Object.values(jobMap)[0];
const history = createBrowserHistory();
const store = configureStore(history);
const { dispatch, getState } = store;

describe('FailureSummaryTab', () => {
  const repoName = 'autoland';

  beforeEach(async () => {
    fetchMock.get(getApiUrl('/jobs/?push_id=511138', repoName), selectedJob);

    fetchMock.get(
      getProjectUrl('/jobs/255514014/bug_suggestions/', repoName),
      bugSuggestions,
    );
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    const { pinnedJobs } = getState();
    pinnedJobs.pinnedJobBugs.clear();
    pinnedJobs.pinnedJobs = {};
  });

  const testFailureSummaryTab = () => (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <PinBoard
          classificationTypes={[{ id: 0, name: 'intermittent' }]}
          isLoggedIn={false}
          currentRepo={repositories[0]}
        />
        <FailureSummaryTab
          selectedJob={selectedJob}
          jobLogUrls={jobLogUrls}
          logParseStatus="parsed"
          reftestUrl="boo"
          logViewerFullUrl="ber/baz"
          /* Calling addBug will show the pinboard which gets checked if the
             correct bug got added. */
          addBug={(bug, job) => addBug(bug, job)(dispatch, getState)}
          pinJob={() => {}}
          repoName={repoName}
        />
      </ConnectedRouter>
    </Provider>
  );

  test('failures should be visible', async () => {
    const { findByText } = render(testFailureSummaryTab());

    expect(
      await findByText(
        'TEST-UNEXPECTED-FAIL | devtools/client/netmonitor/src/har/test/browser_net_har_copy_all_as_har.js | There must be some page title -',
      ),
    ).toBeInTheDocument();
  });

  test('suggested duplicate bugs should mention open bug', async () => {
    const { findByText } = render(testFailureSummaryTab());

    await waitFor(() => screen.getAllByText('Show more bug suggestions'));
    fireEvent.click(screen.getAllByText('Show more bug suggestions')[1]);
    await waitFor(() => screen.getByText('Hide bug suggestions'));
    const duplicateSummary = await findByText('1725755');
    const openBugPart = duplicateSummary.nextSibling;
    expect(openBugPart.textContent).toEqual(' >1725749');
  });

  test('suggested non-duplicate bugs should not mention other bug like duplicates do', async () => {
    const { findByText } = render(testFailureSummaryTab());

    await waitFor(() => screen.getAllByText('Show more bug suggestions'));
    fireEvent.click(screen.getAllByText('Show more bug suggestions')[1]);
    await waitFor(() => screen.getByText('Hide bug suggestions'));
    const duplicateSummary = await findByText('1725755');
    const openBugPart = duplicateSummary.nextSibling;
    expect(openBugPart.textContent).toEqual(' >1725749');
  });

  test('classification with match to duplicate bug should put open bug into pinboard', async () => {
    const { findByText } = render(testFailureSummaryTab());

    await waitFor(() => screen.getAllByText('Show more bug suggestions'));
    fireEvent.click(screen.getAllByText('Show more bug suggestions')[1]);
    await waitFor(() => screen.getByText('Hide bug suggestions'));
    const duplicateSummary = await findByText('1725755');
    fireEvent.click(duplicateSummary.previousSibling);
    await waitFor(() => screen.getByTestId('pinboard-bug-1725749'));
    expect(screen.getByTestId('pinboard-bug-1725749').textContent).toEqual(
      '1725749',
    );
  });
});
