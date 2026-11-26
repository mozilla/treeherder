import { getData } from '../../helpers/http';
import { getProjectUrl } from '../../helpers/location';
import { createApiUrl } from '../../helpers/url';

// Signatures or jobs per request, so the URLs stay short
const batchSize = 100;
// How far from the alerting push to look for a test that didn't run on it
const searchWindowDays = 3;
const daySeconds = 24 * 60 * 60;

const toBatches = (items) =>
  Array.from({ length: Math.ceil(items.length / batchSize) }, (_, i) =>
    items.slice(i * batchSize, (i + 1) * batchSize),
  );

const toDate = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 19);

const getDatums = async (repository, signatureIds, params) => {
  const responses = await Promise.all(
    toBatches(signatureIds).map((ids) => {
      const query = new URLSearchParams([
        ...ids.map((id) => ['signature_id', id]),
        ...params,
      ]);
      return getData(
        `${getProjectUrl('/performance/data/', repository)}?${query}`,
      );
    }),
  );
  return responses.flatMap(({ data, failureStatus }) =>
    failureStatus ? [] : Object.values(data).flat(),
  );
};

const getJobs = async (jobIds) => {
  const responses = await Promise.all(
    toBatches(jobIds).map((ids) =>
      getData(createApiUrl('/jobs/', { id__in: ids.join(','), count: ids.length })),
    ),
  );
  const jobs = new Map();
  responses.forEach(({ data, failureStatus }) => {
    if (failureStatus) return;
    data.results.forEach((row) => {
      const job = Object.fromEntries(
        data.job_property_names.map((name, i) => [name, row[i]]),
      );
      jobs.set(job.id, {
        task_id: job.task_id,
        retry_id: job.retry_id,
        label: job.job_type_name,
        revision: job.push_revision,
      });
    });
  });
  return jobs;
};

// First data point of each signature, from the earliest or the latest push
const pickDatums = (datums, latest = false) => {
  const picked = new Map();
  datums.forEach((datum) => {
    const current = picked.get(datum.signature_id);
    const isBetter = latest
      ? datum.push_timestamp > current?.push_timestamp
      : datum.push_timestamp < current?.push_timestamp;
    if (!current || isBetter) {
      picked.set(datum.signature_id, datum);
    }
  });
  return picked;
};

// alert ID -> { before, after } task, from the closest push that ran the test
export const getAlertTasks = async (alertSummary, alerts) => {
  const {
    repository,
    push_id: pushId,
    prev_push_id: prevPushId,
    push_timestamp: pushTimestamp,
  } = alertSummary;
  const signatureIds = [
    ...new Set(alerts.map((alert) => alert.series_signature.id)),
  ];
  if (signatureIds.length === 0) {
    return new Map();
  }

  const pushDatums = await getDatums(repository, signatureIds, [
    ['push_id', pushId],
    ['push_id', prevPushId],
  ]);
  const after = pickDatums(
    pushDatums.filter((datum) => datum.push_id === pushId),
  );
  const before = pickDatums(
    pushDatums.filter((datum) => datum.push_id === prevPushId),
  );

  const window = searchWindowDays * daySeconds;
  const missingAfter = signatureIds.filter((id) => !after.has(id));
  const missingBefore = signatureIds.filter((id) => !before.has(id));
  const [laterDatums, earlierDatums] = await Promise.all([
    missingAfter.length
      ? getDatums(repository, missingAfter, [
          ['start_date', toDate(pushTimestamp)],
          ['end_date', toDate(pushTimestamp + window)],
        ])
      : [],
    missingBefore.length
      ? getDatums(repository, missingBefore, [
          ['start_date', toDate(pushTimestamp - window)],
          ['end_date', toDate(pushTimestamp)],
        ])
      : [],
  ]);
  pickDatums(laterDatums).forEach((datum, id) => after.set(id, datum));
  pickDatums(earlierDatums, true).forEach((datum, id) => before.set(id, datum));

  // old data points lose their job when Treeherder expires the job data
  const jobIds = [
    ...new Set(
      [...after.values(), ...before.values()]
        .map((datum) => datum.job_id)
        .filter(Boolean),
    ),
  ];
  const jobs = jobIds.length ? await getJobs(jobIds) : new Map();
  const getTask = (datum) => (datum && jobs.get(datum.job_id)) || null;

  return new Map(
    alerts.map((alert) => {
      const { id } = alert.series_signature;
      return [
        alert.id,
        { before: getTask(before.get(id)), after: getTask(after.get(id)) },
      ];
    }),
  );
};

export default getAlertTasks;
