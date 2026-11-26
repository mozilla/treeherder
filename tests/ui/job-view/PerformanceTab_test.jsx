
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

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
          {
            url: 'https://example.com/public/profile_run-task-resource-usage.json',
            value: 'profile_run-task-resource-usage.json',
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
            url: 'https://example.com/public/profile_run-task-resource-usage.json',
            value: 'profile_run-task-resource-usage.json',
          },
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

  test('perf test job with json.gz profile should show retrigger button and open button', async () => {
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
            url: 'profile_something.json.gz',
            value: 'profile_something.json.gz',
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
      'https://profiler.firefox.com/from-url/profile_something.json.gz',
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

  test('non-perf job prefers the run-task resource profile to a generic profile', () => {
    const resourceUrl =
      'https://example.com/public/profile_run-task-resource-usage.json';
    const { getByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name: 'build-linux/opt',
          job_type_symbol: 'B',
          job_group_name: 'Builds',
          task_id: 'task-id',
          retry_id: 0,
        },
        jobDetails: [
          { url: 'profile_something.json', value: 'profile_something.json' },
          {
            url: resourceUrl,
            value: 'profile_run-task-resource-usage.json',
          },
        ],
        perfJobDetail: [
          {
            frameworkName: 'build_metrics',
            perfdocs: { hasDocumentation: () => false },
          },
        ],
      }),
    );

    expect(getByTestId('open-profiler').href).toBe(
      `https://profiler.firefox.com/from-url/${encodeURIComponent(resourceUrl)}` +
        `?profileName=${encodeURIComponent('build-linux/opt (task-id.0)')}`,
    );
  });

  test('A/B job shows a comparison link for each base/new profile pair', () => {
    const artifact = (path, value) => ({
      url: `https://tc.example/artifacts/public/${path}/${value}`,
      path,
      value,
    });
    const { getAllByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name: 'browsertime-benchmark-firefox-sp3-vs-custom-car',
          job_type_symbol: 'sp3',
          job_group_name: 'Browsertime',
          abSideNames: ['Chrome', 'Firefox'],
        },
        jobDetails: [
          artifact('test_info/base', 'profile_sp3_compact.jslb.gz'),
          artifact('test_info/new', 'profile_sp3_compact.jslb.gz'),
          artifact('test_info/base', 'profile_sp3_all_processes.jslb.gz'),
          artifact('test_info/new', 'profile_sp3_all_processes.jslb.gz'),
          artifact('test_info/base', 'profile_only-base_compact.jslb.gz'),
        ],
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: { hasDocumentation: () => false },
          },
        ],
      }),
    );

    const links = getAllByTestId('compare-ab-profiles');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Open profile comparison');
    const url = new URL(links[0].href);
    expect(url.origin + url.pathname).toBe(
      'https://deploy-preview-6012--perf-html.netlify.app/compare-benchmark/',
    );
    expect(url.searchParams.getAll('names[]')).toEqual(['Chrome', 'Firefox']);
    expect(url.searchParams.getAll('profiles[]')).toEqual(
      ['base', 'new'].map(
        (side) =>
          `https://profiler.firefox.com/from-url/${encodeURIComponent(
            `https://tc.example/artifacts/public/test_info/${side}/profile_sp3_compact.jslb.gz`,
          )}/calltree/?globalTrackOrder=0&thread=0&v=17`,
      ),
    );
  });

  test('A/B job with the same browser on both sides uses Base and New', () => {
    const { getByTestId } = render(
      testPerformanceTab({
        selectedJobFull: {
          job_type_name: 'browsertime-benchmark-firefox-sp3-ab',
          job_type_symbol: 'sp3',
          job_group_name: 'Browsertime',
          abSideNames: null,
        },
        jobDetails: ['base', 'new'].map((side) => ({
          url: `https://tc.example/test_info/${side}/profile_sp3_compact.jslb.gz`,
          path: `test_info/${side}`,
          value: 'profile_sp3_compact.jslb.gz',
        })),
        perfJobDetail: [
          {
            frameworkName: 'browsertime',
            perfdocs: { hasDocumentation: () => false },
          },
        ],
      }),
    );

    const url = new URL(getByTestId('compare-ab-profiles').href);
    expect(url.searchParams.getAll('names[]')).toEqual(['Base', 'New']);
  });
});
