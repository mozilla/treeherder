import React from 'react';
import { render, waitFor } from '@testing-library/react';

import Job from '../../../ui/push-health/Job';
import pushHealth from '../mock/push_health';

const repoName = 'try';
const { jobs, metrics } = pushHealth;

const failJob = jobs[metrics.tests.details.needInvestigation[0].jobName].find(
  (job) => job.result === 'testfailed',
);

const failBuild = metrics.builds.details[0];
const passJob = jobs[metrics.tests.details.knownIssues[0].jobName].find(
  (job) => job.result === 'success',
);

describe('Job', () => {
  const testJob = (job) => (
    <Job
      job={job}
      repo={repoName}
      revision="cd02b96bdce57d9ae53b632ca4740c871d3ecc32"
    />
  );

  test('should show a failed job in NeedsInvestigation', async () => {
    const { getByText } = render(testJob(failJob));
    const job = await waitFor(() => getByText('R1'));

    expect(job.getAttribute('href')).toBe(
      '/jobs?selectedJob=285852125&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-orange-classified');
  });

  test('should show a success job in Intermittent', async () => {
    const { getByText } = render(testJob(passJob));
    const job = await waitFor(() => getByText('bc6'));

    expect(job.getAttribute('href')).toBe(
      '/jobs?selectedJob=285859045&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-green');
  });

  test('should show a success job in Builds', async () => {
    const { getByText } = render(testJob(failBuild));
    const job = await waitFor(() => getByText('arm64'));

    expect(job.getAttribute('href')).toBe(
      '/jobs?selectedJob=294399307&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-red');
    expect(getByText('Failed in parent')).toBeInTheDocument();
  });
});
