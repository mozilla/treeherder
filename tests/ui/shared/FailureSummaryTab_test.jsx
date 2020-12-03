import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup } from '@testing-library/react';
import { createBrowserHistory } from 'history';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';

import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import FailureSummaryTab from '../../../ui/shared/tabs/failureSummary/FailureSummaryTab';
import jobMap from '../mock/job_map';
import bugSuggestions from '../mock/bug_suggestions.json';
import jobLogUrls from '../mock/job_log_urls.json';
import { configureStore } from '../../../ui/job-view/redux/configureStore';

const selectedJob = Object.values(jobMap)[0];
const history = createBrowserHistory();
const store = configureStore(history);

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
  });

  const testFailureSummaryTab = () => (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <FailureSummaryTab
          selectedJob={selectedJob}
          jobLogUrls={jobLogUrls}
          logParseStatus="parsed"
          reftestUrl="boo"
          logViewerFullUrl="ber/baz"
          addBug={() => {}}
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
});
