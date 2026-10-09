import { act, fireEvent, render, screen } from '@testing-library/react';

import Retrigger from '../../../ui/simple-view/Retrigger';
import { retriggerableJobs } from '../../../ui/simple-view/helpers';
import JobModel from '../../../ui/models/job';
import RepositoryModel from '../../../ui/models/repository';
import taskcluster, { tcCredentialsMessage } from '../../../ui/helpers/taskcluster';
import { prodFirefoxRootUrl } from '../../../ui/taskcluster-auth-callback/constants';

jest.mock('../../../ui/models/job');
jest.mock('../../../ui/models/repository');

const jobs = [
  { id: 1, push_id: 9, job_type_name: 'test-a' },
  { id: 2, push_id: 9, job_type_name: 'test-b' },
];

const signIn = () =>
  localStorage.setItem(
    'userCredentials',
    JSON.stringify({
      [prodFirefoxRootUrl]: {
        credentials: { clientId: 'me', accessToken: 'x' },
        expires: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    }),
  );

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  RepositoryModel.getList.mockResolvedValue([{ name: 'try' }]);
  RepositoryModel.getRepo.mockImplementation((name, list) =>
    list.find((r) => r.name === name),
  );
  JobModel.retrigger.mockReset();
  jest.spyOn(taskcluster, 'getAuthCode').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const button = () => screen.getByRole('button');

test('one tap only asks; nothing is sent', () => {
  signIn();
  render(<Retrigger jobs={jobs} repo="try" live />);
  expect(button()).toHaveTextContent('Rerun the 2 failed test jobs');
  fireEvent.click(button());
  expect(button()).toHaveTextContent('Tap again to rerun 2 jobs');
  expect(JobModel.retrigger).not.toHaveBeenCalled();
});

test('an unanswered confirm backs off', () => {
  render(<Retrigger jobs={jobs} repo="try" live />);
  fireEvent.click(button());
  act(() => jest.advanceTimersByTime(4000));
  expect(button()).toHaveTextContent('Rerun the 2 failed test jobs');
});

test('a failed repository lookup says so, and a retry asks again', async () => {
  signIn();
  RepositoryModel.getList
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([{ name: 'try' }]);
  render(<Retrigger jobs={jobs} repo="try" live />);
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(button()).toHaveTextContent("Couldn't send that.");
  expect(JobModel.retrigger).not.toHaveBeenCalled();

  await act(async () => fireEvent.click(button()));
  expect(JobModel.retrigger).toHaveBeenCalledTimes(1);
});

test('signed in, the second tap sends and reports success', async () => {
  signIn();
  JobModel.retrigger.mockImplementation((j, repo, notify) =>
    notify('Request sent to retrigger/add new jobs via actions.json (abc)'),
  );
  render(<Retrigger jobs={jobs} repo="try" live />);
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(taskcluster.getAuthCode).not.toHaveBeenCalled();
  expect(JobModel.retrigger).toHaveBeenCalledWith(
    jobs,
    { name: 'try' },
    expect.any(Function),
  );
  expect(button()).toHaveTextContent("Sent. They'll show up here as they run.");
  expect(button()).toBeDisabled();
});

test('not signed in, the tap itself opens Taskcluster approval and sends nothing', async () => {
  render(<Retrigger jobs={jobs} repo="try" live />);
  fireEvent.click(button());
  // No await: the approval tab must open inside the tap, or phones block it.
  fireEvent.click(button());
  expect(taskcluster.getAuthCode).toHaveBeenCalledTimes(1);
  expect(JobModel.retrigger).not.toHaveBeenCalled();
  expect(button()).toHaveTextContent('Approve Taskcluster in the new tab');

  signIn();
  await act(async () => fireEvent.click(button()));
  expect(JobModel.retrigger).toHaveBeenCalledTimes(1);
  expect(taskcluster.getAuthCode).toHaveBeenCalledTimes(1);
});

test('credentials that lapse mid-send still ask for approval', async () => {
  signIn();
  JobModel.retrigger.mockImplementationOnce((j, repo, notify) =>
    notify(`Unable to retrigger/add jobs.  ${tcCredentialsMessage}`, 'danger'),
  );
  render(<Retrigger jobs={jobs} repo="try" live />);
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(button()).toHaveTextContent('Approve Taskcluster in the new tab');
});

test('a failure says so', async () => {
  signIn();
  JobModel.retrigger.mockImplementation((j, repo, notify) =>
    notify('Retrigger failed with Decision task: x: boom', 'danger'),
  );
  render(<Retrigger jobs={[jobs[0]]} repo="try" live />);
  expect(button()).toHaveTextContent('Rerun the failed test job');
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(button()).toHaveTextContent("Couldn't send that.");
});

test('where Taskcluster cannot sign in, it says so and never sends', () => {
  render(<Retrigger jobs={jobs} repo="try" live={false} />);
  fireEvent.click(button());
  expect(button()).toHaveTextContent(
    "Retrigger sends from treeherder.mozilla.org. This domain can't sign in to Taskcluster.",
  );
  fireEvent.click(button());
  expect(JobModel.retrigger).not.toHaveBeenCalled();
  expect(taskcluster.getAuthCode).not.toHaveBeenCalled();
});

test('only failed test jobs nobody has answered yet are rerun', () => {
  const job = (id, extra) => ({
    id,
    tier: 1,
    state: 'completed',
    result: 'testfailed',
    classification: 1,
    platform: 'macosx1500-aarch64',
    symbol: 'bc',
    jobTypeName: `test-macosx1500-aarch64/debug-mochitest-browser-chrome-${id}`,
    ...extra,
  });
  const retried = 'test-macosx1500-aarch64/opt-mochitest-plain-xorig-4';
  const list = [
    job(1), // failed once, unclassified: rerun
    job(2, { classification: 6 }), // failed once, new failure: rerun
    job(3, { classification: 8 }), // marked intermittent (needs bug id)
    job(4, { classification: 4 }), // intermittent
    job(5, { classification: 5 }), // infra
    job(6, { jobTypeName: retried }), // failed, then retriggered...
    job(7, { jobTypeName: retried, result: 'success' }), // ...and passed
    job(8, { jobTypeName: 'rerun-in-flight' }),
    job(9, { jobTypeName: 'rerun-in-flight', state: 'running', result: 'unknown' }),
    job(10, { platform: 'lint', jobTypeName: 'source-test-mozlint-eslint' }),
    job(11, { symbol: 'mozlint', jobTypeName: 'source-test-mozlint-codespell' }),
    job(12, { jobTypeName: 'build-linux64/opt' }),
    job(13, { result: 'busted' }),
    job(14, { tier: 3 }),
  ];
  expect(retriggerableJobs(list, 42)).toEqual([
    { id: 1, push_id: 42, job_type_name: job(1).jobTypeName },
    { id: 2, push_id: 42, job_type_name: job(2).jobTypeName },
  ]);
});

test('a job that failed on every rebuild is not offered again', () => {
  const name = 'test-macosx1500-aarch64/opt-mochitest-browser-chrome-1';
  const runs = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    tier: 1,
    state: 'completed',
    result: 'testfailed',
    classification: 1,
    platform: 'macosx1500-aarch64',
    symbol: 'bc1',
    jobTypeName: name,
  }));
  expect(retriggerableJobs(runs, 1)).toEqual([]);
});
