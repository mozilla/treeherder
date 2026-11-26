import fetchMock from 'fetch-mock';

import { getAlertTasks } from '../../../ui/perfherder/perf-helpers/alertTasks';

const pushTimestamp = 1789075964; // 2026-09-10T21:32:44
const alertSummary = {
  repository: 'autoland',
  push_id: 200,
  prev_push_id: 100,
  push_timestamp: pushTimestamp,
};
const getAlert = (id, signatureId) => ({
  id,
  series_signature: { id: signatureId },
});
const datum = (signatureId, pushId, jobId, timestamp = pushTimestamp) => ({
  signature_id: signatureId,
  push_id: pushId,
  job_id: jobId,
  push_timestamp: timestamp,
});
const jobsResponse = (jobs) => ({
  job_property_names: [
    'id',
    'job_type_name',
    'task_id',
    'retry_id',
    'push_revision',
  ],
  results: jobs.map((job) => [
    job.id,
    job.label,
    job.taskId,
    0,
    job.revision,
  ]),
});
const pushDataUrl = (signatureIds) =>
  `/api/project/autoland/performance/data/?${signatureIds
    .map((id) => `signature_id=${id}`)
    .join('&')}&push_id=200&push_id=100`;

describe('getAlertTasks', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  test('gives the tasks and labels of both pushes', async () => {
    fetchMock.get(pushDataUrl([10]), {
      sigHash: [datum(10, 200, 2), datum(10, 100, 1, pushTimestamp - 600)],
    });
    fetchMock.get(
      '/api/jobs/?id__in=2%2C1&count=2',
      jobsResponse([
        { id: 1, label: 'test-a/opt-talos-x', taskId: 'before', revision: 'rev1' },
        { id: 2, label: 'test-a/opt-talos-x', taskId: 'after', revision: 'rev2' },
      ]),
    );

    const tasks = await getAlertTasks(alertSummary, [getAlert(5, 10)]);

    expect(tasks.get(5)).toEqual({
      before: {
        task_id: 'before',
        retry_id: 0,
        label: 'test-a/opt-talos-x',
        revision: 'rev1',
      },
      after: {
        task_id: 'after',
        retry_id: 0,
        label: 'test-a/opt-talos-x',
        revision: 'rev2',
      },
    });
  });

  test('looks for the closest pushes that ran the test', async () => {
    fetchMock.get(pushDataUrl([10]), { sigHash: [] });
    fetchMock.get(
      '/api/project/autoland/performance/data/?signature_id=10&start_date=2026-09-10T21%3A32%3A44&end_date=2026-09-13T21%3A32%3A44',
      {
        sigHash: [
          datum(10, 202, 4, pushTimestamp + 7200),
          datum(10, 201, 3, pushTimestamp + 3600),
        ],
      },
    );
    fetchMock.get(
      '/api/project/autoland/performance/data/?signature_id=10&start_date=2026-09-07T21%3A32%3A44&end_date=2026-09-10T21%3A32%3A44',
      {
        sigHash: [
          datum(10, 98, 5, pushTimestamp - 7200),
          datum(10, 99, 6, pushTimestamp - 3600),
        ],
      },
    );
    fetchMock.get(
      '/api/jobs/?id__in=3%2C6&count=2',
      jobsResponse([
        { id: 3, label: 'test-a/opt-talos-x', taskId: 'next', revision: 'rev201' },
        { id: 6, label: 'test-a/opt-talos-x', taskId: 'last', revision: 'rev99' },
      ]),
    );

    const tasks = await getAlertTasks(alertSummary, [getAlert(5, 10)]);

    // the earliest push after the alert, and the latest push before it
    expect(tasks.get(5).after.task_id).toBe('next');
    expect(tasks.get(5).before.task_id).toBe('last');
  });

  test('leaves a side empty when no push ran the test', async () => {
    fetchMock.get(pushDataUrl([10]), { sigHash: [datum(10, 100, 1)] });
    fetchMock.get('begin:/api/project/autoland/performance/data/?signature_id=10&start_date', {});
    fetchMock.get(
      '/api/jobs/?id__in=1&count=1',
      jobsResponse([{ id: 1, label: 'x', taskId: 'before', revision: 'rev1' }]),
    );

    const tasks = await getAlertTasks(alertSummary, [getAlert(5, 10)]);

    expect(tasks.get(5).before.task_id).toBe('before');
    expect(tasks.get(5).after).toBeNull();
  });

  test('skips data points whose job was expired', async () => {
    fetchMock.get(pushDataUrl([10]), {
      sigHash: [datum(10, 200, null), datum(10, 100, null)],
    });

    const tasks = await getAlertTasks(alertSummary, [getAlert(5, 10)]);

    expect(tasks.get(5)).toEqual({ before: null, after: null });
    expect(fetchMock.calls()).toHaveLength(1);
  });

  test('is empty without alerts', async () => {
    expect((await getAlertTasks(alertSummary, [])).size).toBe(0);
    expect(fetchMock.calls()).toHaveLength(0);
  });
});
