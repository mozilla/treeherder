import { render, cleanup } from '@testing-library/react';

import JobArtifacts from '../../../ui/shared/JobArtifacts';

describe('JobArtifacts', () => {
  const selectedJob = {
    task_id: 'abc123',
    result: 'success',
    build_platform: 'windows10-64',
  };

  const renderArtifacts = (jobDetails) =>
    render(
      <JobArtifacts
        jobDetails={jobDetails}
        jobArtifactsLoading={false}
        repoName="try"
        selectedJob={selectedJob}
      />,
    );

  afterEach(cleanup);

  test('shows "open in Firefox Profiler" link for profile_*.json.gz artifact', () => {
    const { getByText } = renderArtifacts([
      {
        url: 'https://example.com/profile_editor-tiptap-16.json.gz',
        value: 'profile_editor-tiptap-16.json.gz',
      },
    ]);

    const link = getByText('open in Firefox Profiler');
    expect(link.href).toBe(
      'https://profiler.firefox.com/from-url/https%3A%2F%2Fexample.com%2Fprofile_editor-tiptap-16.json.gz',
    );
  });

  test('does not show profiler link for non-profile artifacts', () => {
    const { queryByText } = renderArtifacts([
      {
        url: 'https://example.com/log.txt',
        value: 'log.txt',
      },
    ]);

    expect(queryByText('open in Firefox Profiler')).toBeNull();
  });
});
