import React from 'react';
import { render } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import {
  configureStore,
  history,
} from '../../../ui/job-view/redux/configureStore';
import PerformanceTab from '../../../ui/job-view/details/tabs/PerformanceTab.jsx';

describe('PerformanceTab', () => {
  const testPerformanceTab = ({
    selectedJobFull,
    jobDetails,
    perfJobDetail,
  }) => {
    const repoName = 'try';
    const currentRepo = { name: repoName };

    const store = configureStore();

    return (
      <Provider store={store} context={ReactReduxContext}>
        <ConnectedRouter history={history} context={ReactReduxContext}>
          <PerformanceTab
            selectedJobFull={selectedJobFull}
            currentRepo={currentRepo}
            repoName={repoName}
            jobDetails={jobDetails}
            perfJobDetail={perfJobDetail}
            revision="REV1"
          />
        </ConnectedRouter>
      </Provider>
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
        perfJobDetail: [],
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
        perfJobDetail: [],
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
        perfJobDetail: [],
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
        perfJobDetail: [],
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
        perfJobDetail: [],
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
