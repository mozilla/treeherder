import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SimilarJobsTab from '../../../ui/job-view/details/tabs/SimilarJobsTab';
import JobModel from '../../../ui/models/job';
import PushModel from '../../../ui/models/push';
import {
  similarJobsCache,
  setSimilarJobsSnapshot,
  SIMILAR_JOBS_REVALIDATE_MS,
} from '../../../ui/job-view/details/tabs/similarJobsCache';

jest.mock('../../../ui/models/job', () => ({
  __esModule: true,
  default: { getSimilarJobs: jest.fn(), get: jest.fn() },
}));
jest.mock('../../../ui/models/push', () => ({
  __esModule: true,
  default: { getList: jest.fn() },
}));
jest.mock('../../../ui/helpers/http', () => ({
  getData: jest.fn(() => Promise.resolve({ data: [], failureStatus: null })),
}));

// A job-detail object with the fields addAggregateFields()/getResultState() need.
const detailJob = (id) => ({
  id,
  job_group_name: 'group',
  job_type_name: 'reftest',
  job_type_symbol: 'R2',
  platform: 'linux',
  platform_option: 'opt',
  submit_timestamp: 1600000000,
  start_timestamp: 1600000000,
  end_timestamp: 1600000060,
  duration: 4,
  state: 'completed',
  result: 'success',
  failure_classification_id: 1,
});

const JOB_ID = 500;
const classificationMap = { 1: { star: 'label-default', name: 'unclassified' } };

// A fully enriched similar-job row, as it lives in a cached snapshot.
const enrichedJob = (id, symbol = 'R1') => ({
  id,
  push_id: 5,
  job_type_symbol: symbol,
  failure_classification_id: 1,
  resultStatus: 'success',
  duration: 3,
  result_set: {
    push_timestamp: 1600000000,
    author: 'dev@example.com',
    revisions: [{ revision: 'abc123def456' }],
  },
  revisionResultsetFilterUrl: '#rev',
  authorResultsetFilterUrl: '#author',
});

const renderTab = () =>
  render(
    <MemoryRouter>
      <SimilarJobsTab
        repoName="autoland"
        classificationMap={classificationMap}
        selectedJobFull={{ id: JOB_ID }}
      />
    </MemoryRouter>,
  );

describe('SimilarJobsTab caching', () => {
  beforeEach(() => {
    similarJobsCache.clear();
    JobModel.getSimilarJobs.mockReset();
    JobModel.get.mockReset();
    JobModel.get.mockResolvedValue(detailJob(601));
    PushModel.getList.mockReset();
    // Default fetch responses for the cache-miss / revalidate paths.
    JobModel.getSimilarJobs.mockResolvedValue({
      data: [
        {
          id: 601,
          push_id: 5,
          job_type_symbol: 'R2',
          failure_classification_id: 1,
          resultStatus: 'success',
          duration: 4,
        },
      ],
      failureStatus: null,
    });
    PushModel.getList.mockResolvedValue({
      data: {
        results: [
          {
            id: 5,
            push_timestamp: 1600000000,
            author: 'dev@example.com',
            revisions: [{ revision: 'abc123def456' }],
          },
        ],
      },
      failureStatus: null,
    });
  });

  test('fetches on a cache miss and renders the results', async () => {
    renderTab();

    await waitFor(() =>
      expect(JobModel.getSimilarJobs).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText('R2')).toBeInTheDocument();
  });

  test('hydrates from a fresh snapshot without revalidating (dedup)', async () => {
    setSimilarJobsSnapshot(JOB_ID, {
      similarJobs: [enrichedJob(701, 'CACHED')],
      page: 1,
      filterNoSuccessfulJobs: false,
      selectedSimilarJob: null,
      hasNextPage: false,
      timestamp: Date.now(), // fresh
    });

    renderTab();

    // Restored instantly from cache...
    expect(await screen.findByText('CACHED')).toBeInTheDocument();
    // ...and, being fresh, no background revalidate fires.
    await waitFor(() => {});
    expect(JobModel.getSimilarJobs).not.toHaveBeenCalled();
  });

  test('hydrates from a stale snapshot and revalidates in the background', async () => {
    setSimilarJobsSnapshot(JOB_ID, {
      similarJobs: [enrichedJob(801, 'STALE')],
      page: 1,
      filterNoSuccessfulJobs: false,
      selectedSimilarJob: null,
      hasNextPage: false,
      timestamp: Date.now() - SIMILAR_JOBS_REVALIDATE_MS - 1, // stale
    });

    renderTab();

    // Cached row shows immediately.
    expect(await screen.findByText('STALE')).toBeInTheDocument();
    // Stale -> background revalidate fetches fresh data and swaps it in.
    await waitFor(() =>
      expect(JobModel.getSimilarJobs).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText('R2')).toBeInTheDocument();
  });
});
