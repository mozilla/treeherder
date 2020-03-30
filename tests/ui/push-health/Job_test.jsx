import React from 'react';
import { render, waitForElement } from '@testing-library/react';

import Job from '../../../ui/push-health/Job';
import pushHealth from '../mock/push_health';

const repoName = 'try';
const failJob =
  pushHealth.metrics.tests.details.needInvestigation[5].failJobs[0];
const failBuild = pushHealth.metrics.builds.details[0];
const passJob =
  pushHealth.metrics.tests.details.needInvestigation[5].passJobs[0];

describe('Job', () => {
  const testJob = job => (
    <Job
      job={job}
      repo={repoName}
      revision="cd02b96bdce57d9ae53b632ca4740c871d3ecc32"
    />
  );

  test('should show a failed job in NeedsInvestigation', async () => {
    const { getByText } = render(testJob(failJob));
    const job = await waitForElement(() => getByText('R2'));

    expect(job.getAttribute('href')).toBe(
      '/#/jobs?selectedJob=285869990&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-orange-classified');
  });

  test('should show a success job in NeedsInvestigation', async () => {
    const { getByText } = render(testJob(passJob));
    const job = await waitForElement(() => getByText('R2'));

    expect(job.getAttribute('href')).toBe(
      '/#/jobs?selectedJob=285869991&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-green');
  });

  test('should show a success job in Builds', async () => {
    const { getByText } = render(testJob(failBuild));
    const job = await waitForElement(() => getByText('arm64'));

    expect(job.getAttribute('href')).toBe(
      '/#/jobs?selectedJob=294399307&repo=try&revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
    );
    expect(job).toHaveClass('btn-red');
    expect(getByText('Failed in parent')).toBeInTheDocument();
  });
});
