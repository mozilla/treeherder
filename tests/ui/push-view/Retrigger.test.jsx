import { act, fireEvent, render, screen } from '@testing-library/react';

import Retrigger from '../../../ui/push-view/Retrigger';
import JobModel from '../../../ui/models/job';
import RepositoryModel from '../../../ui/models/repository';
import { tcCredentialsMessage } from '../../../ui/helpers/taskcluster';

jest.mock('../../../ui/models/job');
jest.mock('../../../ui/models/repository');

const jobs = [
  { id: 1, push_id: 9, job_type_name: 'test-a' },
  { id: 2, push_id: 9, job_type_name: 'test-b' },
];

beforeEach(() => {
  jest.useFakeTimers();
  RepositoryModel.getList.mockResolvedValue([{ name: 'try' }]);
  RepositoryModel.getRepo.mockImplementation((name, list) =>
    list.find((r) => r.name === name),
  );
  JobModel.retrigger.mockReset();
});

afterEach(() => jest.useRealTimers());

const button = () => screen.getByRole('button');

test('one tap only asks; nothing is sent', () => {
  render(<Retrigger jobs={jobs} repo="try" />);
  expect(button()).toHaveTextContent('Run the 2 failures again');
  fireEvent.click(button());
  expect(button()).toHaveTextContent('Tap again to rerun 2 jobs');
  expect(JobModel.retrigger).not.toHaveBeenCalled();
});

test('an unanswered confirm backs off', () => {
  render(<Retrigger jobs={jobs} repo="try" />);
  fireEvent.click(button());
  act(() => jest.advanceTimersByTime(4000));
  expect(button()).toHaveTextContent('Run the 2 failures again');
});

test('the second tap sends and reports success', async () => {
  JobModel.retrigger.mockImplementation((j, repo, notify) =>
    notify('Request sent to retrigger/add new jobs via actions.json (abc)'),
  );
  render(<Retrigger jobs={jobs} repo="try" />);
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(JobModel.retrigger).toHaveBeenCalledWith(
    jobs,
    { name: 'try' },
    expect.any(Function),
  );
  expect(button()).toHaveTextContent("Sent. They'll show up here as they run.");
  expect(button()).toBeDisabled();
});

test('missing Taskcluster credentials ask for approval, then resend', async () => {
  JobModel.retrigger.mockImplementationOnce((j, repo, notify) =>
    notify(`Unable to retrigger/add jobs.  ${tcCredentialsMessage}`, 'danger'),
  );
  render(<Retrigger jobs={jobs} repo="try" />);
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(button()).toHaveTextContent('Approve Taskcluster in the new tab');
  await act(async () => fireEvent.click(button()));
  expect(JobModel.retrigger).toHaveBeenCalledTimes(2);
});

test('a failure says so', async () => {
  JobModel.retrigger.mockImplementation((j, repo, notify) =>
    notify('Retrigger failed with Decision task: x: boom', 'danger'),
  );
  render(<Retrigger jobs={[jobs[0]]} repo="try" />);
  expect(button()).toHaveTextContent('Run the failure again');
  fireEvent.click(button());
  await act(async () => fireEvent.click(button()));
  expect(button()).toHaveTextContent("Couldn't send that.");
});
