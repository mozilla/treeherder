import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup } from '@testing-library/react';

import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import FailureSummaryTab from '../../../ui/shared/tabs/failureSummary/FailureSummaryTab';
import jobMap from '../mock/job_map';
import bugSuggestions from '../mock/bug_suggestions.json';
import jobLogUrls from '../mock/job_log_urls.json';

const selectedJob = Object.values(jobMap)[0];

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
