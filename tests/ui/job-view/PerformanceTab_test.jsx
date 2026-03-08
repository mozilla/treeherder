
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PerformanceTab from '../../../ui/job-view/details/tabs/PerformanceTab.jsx';
import { Perfdocs } from '../../../ui/perfherder/perf-helpers/perfdocs';

describe('PerformanceTab', () => {
  const testPerformanceTab = ({
    selectedJobFull,
    jobDetails,
    perfJobDetail,
  }) => {
    const repoName = 'try';
    const currentRepo = { name: repoName };

    return (
      <MemoryRouter>
        <PerformanceTab
          selectedJobFull={selectedJobFull}
          currentRepo={currentRepo}
          repoName={repoName}
          jobDetails={jobDetails}
          perfJobDetail={perfJobDetail}
          revision="REV1"
        />
      </MemoryRouter>
    );
  };

  test('perf test job with no profile should show generate button', async () => {
    const { getByTestId, queryByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name:
            'test-macosx1015-64-shippable-qr/opt-browsertime-something',
          job_type_symbol: 'some',
          job_group_name: 'Browsertime performance tests on Firefox',
          hasSideBySide: false,
        },
        jobDetails: [],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: new Perfdocs(
              'browsertime',
              'outlook',
              'macosx1015-64-shippable-qr',
              'outlook ContentfulSpeedIndex opt cold fission webrender',
            ),
          },
        ],
      }),
    );

    const generateProfile = await getByTestId('generate-profile');
    expect(generateProfile.textContent).toBe('Generate performance profile');

    const openProfiler = queryByTestId('open-profiler');
    expect(openProfiler).toBeNull();
  });

  test('perf test job with resource profile should show generate button', async () => {
    const { getByTestId, queryByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name:
            'test-macosx1015-64-shippable-qr/opt-browsertime-something',
          job_type_symbol: 'some',
          job_group_name: 'Browsertime performance tests on Firefox',
          hasSideBySide: false,
        },
        jobDetails: [
          {
            url: 'dummy',
            value: 'profile_resource-usage.json',
          },
          {
            url: 'dummy',
            value: 'profile_build_resources.json',
          },
        ],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: new Perfdocs(
              'browsertime',
              'outlook',
              'macosx1015-64-shippable-qr',
              'outlook ContentfulSpeedIndex opt cold fission webrender',
            ),
          },
        ],
      }),
    );

    const generateProfile = getByTestId('generate-profile');
    expect(generateProfile.textContent).toBe('Generate performance profile');

    const openProfiler = queryByTestId('open-profiler');
    expect(openProfiler).toBeNull();
  });

  test('perf test job with perf profile should show retrigger button and open button', async () => {
    const { getByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name:
            'test-macosx1015-64-shippable-qr/opt-browsertime-something',
          job_type_symbol: 'some',
          job_group_name: 'Browsertime performance tests on Firefox',
          hasSideBySide: false,
        },
        jobDetails: [
          {
            url: 'profile_something.zip',
            value: 'profile_something.zip',
          },
        ],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: new Perfdocs(
              'browsertime',
              'outlook',
              'macosx1015-64-shippable-qr',
              'outlook ContentfulSpeedIndex opt cold fission webrender',
            ),
          },
        ],
      }),
    );

    const generateProfile = getByTestId('generate-profile');
    expect(generateProfile.textContent).toBe('Re-trigger performance profile');

    const openProfiler = getByTestId('open-profiler');
    expect(openProfiler.href).toBe(
      'https://profiler.firefox.com/from-url/profile_something.zip',
    );
  });

  test('perf test job with both perf and resource profiles should use perf profile', async () => {
    const { getByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name:
            'test-macosx1015-64-shippable-qr/opt-browsertime-something',
          job_type_symbol: 'some',
          job_group_name: 'Browsertime performance tests on Firefox',
          hasSideBySide: false,
        },
        jobDetails: [
          {
            url: 'dummy',
            value: 'profile_resource-usage.json',
          },
          {
            url: 'profile_something.json',
            value: 'profile_something.json',
          },
        ],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: new Perfdocs(
              'browsertime',
              'outlook',
              'macosx1015-64-shippable-qr',
              'outlook ContentfulSpeedIndex opt cold fission webrender',
            ),
          },
        ],
      }),
    );

    const generateProfile = getByTestId('generate-profile');
    expect(generateProfile.textContent).toBe('Re-trigger performance profile');

    const openProfiler = getByTestId('open-profiler');
    expect(openProfiler.href).toBe(
      'https://profiler.firefox.com/from-url/profile_something.json',
    );
  });

  test('perf test should use most relevant profile', async () => {
    const { getByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name:
            'test-macosx1015-64-shippable-qr/opt-browsertime-something',
          job_type_symbol: 'some',
          job_group_name: 'Browsertime performance tests on Firefox',
          hasSideBySide: false,
        },
        jobDetails: [
          {
            url: 'profile_something.json',
            value: 'profile_something.json',
          },
          {
            url: 'profile_something.zip',
            value: 'profile_something.zip',
          },
        ],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: new Perfdocs(
              'browsertime',
              'outlook',
              'macosx1015-64-shippable-qr',
              'outlook ContentfulSpeedIndex opt cold fission webrender',
            ),
          },
        ],
      }),
    );

    const generateProfile = getByTestId('generate-profile');
    expect(generateProfile.textContent).toBe('Re-trigger performance profile');

    const openProfiler = getByTestId('open-profiler');
    expect(openProfiler.href).toBe(
      'https://profiler.firefox.com/from-url/profile_something.zip',
    );
  });
});
