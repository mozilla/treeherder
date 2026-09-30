import { act, fireEvent, render, screen } from '@testing-library/react';

import Retrigger from '../../../ui/push-view/Retrigger';
import { retriggerableJobs } from '../../../ui/push-view/helpers';
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
    "Retrigger sends from treeherder.mozilla.org. This demo can't sign in to Taskcluster.",
  );
  fireEvent.click(button());
  expect(JobModel.retrigger).not.toHaveBeenCalled();
  expect(taskcluster.getAuthCode).not.toHaveBeenCalled();
});

test('only failed test jobs are rerun, as the full view does, once per label', () => {
  const job = (id, extra) => ({
    id,
    tier: 1,
    state: 'completed',
    result: 'testfailed',
    platform: 'macosx1500-aarch64',
    symbol: 'bc',
    jobTypeName: `test-macosx1500-aarch64/debug-mochitest-browser-chrome-${id}`,
    ...extra,
  });
  const list = [
    job(1),
    job(2, { jobTypeName: job(1).jobTypeName }), // a second run, same label
    job(3, { platform: 'lint', jobTypeName: 'source-test-mozlint-eslint' }),
    job(4, { symbol: 'mozlint', jobTypeName: 'source-test-mozlint-codespell' }),
    job(5, { jobTypeName: 'build-linux64/opt' }),
    job(6, { result: 'busted' }),
    job(7, { result: 'success' }),
    job(8, { tier: 3 }),
    job(9, { state: 'running' }),
    job(10),
  ];
  expect(retriggerableJobs(list, 42)).toEqual([
    { id: 1, push_id: 42, job_type_name: job(1).jobTypeName },
    { id: 10, push_id: 42, job_type_name: job(10).jobTypeName },
  ]);
});
