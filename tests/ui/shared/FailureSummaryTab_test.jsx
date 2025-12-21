
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
const store = configureStore();
const { dispatch, getState } = store;

describe('FailureSummaryTab', () => {
  const repoName = 'autoland';
  const currentRepo = { name: repoName };

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
    pinnedJobs.pinnedJobBugs = [];
    pinnedJobs.pinnedJobs = {};
  });

  const testFailureSummaryTab = () => (
    <Provider store={store}>
      <MemoryRouter>
        <PinBoard
          classificationTypes={[{ id: 0, name: 'intermittent' }]}
          isLoggedIn={false}
          currentRepo={repositories[0]}
        />
        <FailureSummaryTab
          selectedJob={selectedJob}
          selectedJobId={selectedJob.id}
          jobLogUrls={jobLogUrls}
          logParseStatus="parsed"
          reftestUrl="boo"
          logViewerFullUrl="ber/baz"
          /* Calling addBug will show the pinboard which gets checked if the
             correct bug got added. */
          addBug={(bug, job) => addBug(bug, job)(dispatch, getState)}
          pinJob={() => {}}
          currentRepo={currentRepo}
        />
      </MemoryRouter>
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
    await waitFor(() => {}); // Wait for state updates after click
    const duplicateSummary = await findByText('(bug 1725755)');
    const openBugPart = duplicateSummary.nextSibling;
    expect(openBugPart.textContent).toBe(' >1725749');
  });

  test('suggested non-duplicate bugs should not mention other bug like duplicates do', async () => {
    const { findByText } = render(testFailureSummaryTab());

    await waitFor(() => screen.getAllByText('Show more bug suggestions'));
    fireEvent.click(screen.getAllByText('Show more bug suggestions')[1]);
    await waitFor(() => screen.getByText('Hide bug suggestions'));
    await waitFor(() => {}); // Wait for state updates after click
    const duplicateSummary = await findByText('(bug 1725755)');
    const openBugPart = duplicateSummary.nextSibling;
    expect(openBugPart.textContent).toBe(' >1725749');
  });

  test('classification with match to duplicate bug should put open bug into pinboard', async () => {
    const { findByText } = render(testFailureSummaryTab());

    await waitFor(() => screen.getAllByText('Show more bug suggestions'));
    fireEvent.click(screen.getAllByText('Show more bug suggestions')[1]);
    await waitFor(() => screen.getByText('Hide bug suggestions'));
    await waitFor(() => {}); // Wait for state updates after click
    const duplicateSummary = await findByText('(bug 1725755)');
    fireEvent.click(duplicateSummary.previousSibling.previousSibling);
    await waitFor(() => screen.getByTestId('pinboard-bug-1725755'));
    expect(screen.getByTestId('pinboard-bug-1725755').textContent).toBe(
      '1725749',
    );
  });

  test('filter by test path contains folder path (one level depth)', async () => {
    /* For web platform tests, the test manifest does not necessarily only
       contain one test folder but can contain subfolders.
       Support for this has not been implemented and the whole test path is
       supposed to be set as filter. */
    render(testFailureSummaryTab());

    await waitFor(() =>
      screen.getByTitle('Filter by test path: trusted-types/'),
    );
    expect(
      screen.getByTitle('Filter by test path: trusted-types/'),
    ).toBeInTheDocument();
  });

  test('filter by test path contains folder path (multiple level depth)', async () => {
    /* For web platform tests, the test manifest does not necessarily only
       contain one test folder but can contain subfolders.
       Support for this has not been implemented and the whole test path is
       supposed to be set as filter. */
    render(testFailureSummaryTab());

    await waitFor(() =>
      screen.getByTitle('Filter by test path: css/css-break/'),
    );
    expect(
      screen.getByTitle('Filter by test path: css/css-break/'),
    ).toBeInTheDocument();
  });
});
