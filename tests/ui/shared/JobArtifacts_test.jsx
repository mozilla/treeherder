import { render, cleanup, fireEvent, screen } from '@testing-library/react';

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

  const apkArtifact = {
    url: 'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/abc123/runs/0/artifacts/public/build/target.arm64-v8a.apk',
    value: 'target.arm64-v8a.apk',
  };

  test('shows a "Download on device QR code" link for APK artifacts only', () => {
    renderArtifacts([
      apkArtifact,
      { url: 'https://example.com/log.txt', value: 'log.txt' },
    ]);

    expect(screen.getAllByText('Download on device QR code')).toHaveLength(1);
  });

  test('opens a QR code of the APK download link', () => {
    renderArtifacts([apkArtifact]);

    expect(screen.queryByTestId('apk-qr-code')).toBeNull();
    fireEvent.click(screen.getByText('Download on device QR code'));

    expect(screen.getByTestId('apk-qr-code')).toBeInTheDocument();
    expect(screen.getByText('target.arm64-v8a.apk', { selector: 'strong' }))
      .toBeInTheDocument();
    expect(screen.getByText('Download link').href).toBe(apkArtifact.url);
  });

  test('closes the QR code', async () => {
    renderArtifacts([apkArtifact]);
    fireEvent.click(screen.getByText('Download on device QR code'));
    fireEvent.click(screen.getByLabelText('Close'));

    await screen.findByText('Download on device QR code');
    expect(screen.queryByText('Download link')).toBeNull();
  });
});
