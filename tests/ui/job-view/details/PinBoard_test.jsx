import React from 'react';
import { Provider, ReactReduxContext } from 'react-redux';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ConnectedRouter } from 'connected-react-router';

import JobModel from '../../../../ui/models/job';
import DetailsPanel from '../../../../ui/job-view/details/DetailsPanel';
import jobListFixtureOne from '../../mock/job_list/job_1';
import pushFixture from '../../mock/push_list.json';
import taskDefinition from '../../mock/task_definition.json';
import { getApiUrl } from '../../../../ui/helpers/url';
import FilterModel from '../../../../ui/models/filter';
import { getProjectUrl } from '../../../../ui/helpers/location';
import {
  history,
  configureStore,
} from '../../../../ui/job-view/redux/configureStore';
import { setSelectedJob } from '../../../../ui/job-view/redux/stores/selectedJob';
import { setPushes } from '../../../../ui/job-view/redux/stores/pushes';
import reposFixture from '../../mock/repositories';
import KeyboardShortcuts from '../../../../ui/job-view/KeyboardShortcuts';
import { pinJobs } from '../../../../ui/job-view/redux/stores/pinnedJobs';

describe('DetailsPanel', () => {
  const repoName = 'autoland';
  const classificationTypes = [{ id: 1, name: 'intermittent' }];
  const classificationMap = { 1: 'intermittent' };
  let jobList = null;
  let store = null;
  const currentRepo = reposFixture[2];
  currentRepo.getRevisionHref = () => 'foo';
  currentRepo.getPushLogHref = () => 'foo';
  const router = { location: history.location };

  beforeEach(async () => {
    fetchMock.get(
      getApiUrl('/jobs/?push_id=511138', repoName),
      jobListFixtureOne,
    );
    jobList = await JobModel.getList({ push_id: 511138 });

    fetchMock.get(getProjectUrl('/jobs/259537372/', repoName), jobList.data[1]);
    fetchMock.get(getProjectUrl('/note/?job_id=259537372', repoName), []);
    fetchMock.get(
      getProjectUrl('/jobs/259537372/text_log_errors/', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/jobs/259537372/bug_suggestions/', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/bug-job-map/?job_id=259537372', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/performance/data/?job_id=259537372', repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl('/job-log-url/?job_id=259537372', 'autoland'),
      [],
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ/runs/0/artifacts',
      { artifacts: [] },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ',
      taskDefinition,
    );
    store = configureStore();
    store.dispatch(setPushes(pushFixture.results, {}, router));
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    history.push('/');
  });

  const testDetailsPanel = () => (
    <div id="global-container" className="height-minus-navbars">
      <Provider store={store} context={ReactReduxContext}>
        <ConnectedRouter history={history} context={ReactReduxContext}>
          <KeyboardShortcuts
            filterModel={
              new FilterModel({
                push: history.push,
                router,
              })
            }
            showOnScreenShortcuts={() => {}}
          >
            <div />
            <div id="th-global-content" data-testid="global-content">
              <DetailsPanel
                currentRepo={currentRepo}
                user={{ isLoggedIn: false }}
                resizedHeight={100}
                classificationTypes={classificationTypes}
                classificationMap={classificationMap}
                router={router}
              />
            </div>
          </KeyboardShortcuts>
        </ConnectedRouter>
      </Provider>
    </div>
  );

  test('pin selected job with button', async () => {
    const { getByTitle } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    fireEvent.click(await waitFor(() => getByTitle('Pin job')));

    expect(await waitFor(() => getByTitle('Unpin job'))).toBeInTheDocument();
    const pinnedJob = await waitFor(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    // Verify the pinned job is a descendent of the pinned-job-list
    expect(pinnedJob.closest('#pinned-job-list')).toBeInTheDocument();
  });

  test('KeyboardShortcut space: pin selected job', async () => {
    const { getByTitle } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    const content = await waitFor(() =>
      document.querySelector('#th-global-content'),
    );
    fireEvent.keyDown(content, { key: 'Space', keyCode: 32 });

    const pinnedJob = await waitFor(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    // Verify the pinned job is a descendent of the pinned-job-list
    expect(pinnedJob.closest('#pinned-job-list')).toBeInTheDocument();
  });

  test('KeyboardShortcut b: pin selected task and edit bug', async () => {
    const { getByPlaceholderText } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    const content = await waitFor(() =>
      document.querySelector('#th-global-content'),
    );

    fireEvent.keyDown(content, { key: 'b', keyCode: 66 });

    const bugInput = await waitFor(() =>
      getByPlaceholderText('enter bug number'),
    );

    expect(bugInput).toBe(document.activeElement);
    // cleanup to avoid an error
    fireEvent.keyDown(content, { key: 'Escape', keyCode: 27 });
  });

  test('KeyboardShortcut c: pin selected task and edit comment', async () => {
    const { getByPlaceholderText } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    const content = await waitFor(() =>
      document.querySelector('#th-global-content'),
    );

    fireEvent.keyDown(content, { key: 'c', keyCode: 67 });

    const commentInput = await waitFor(() =>
      getByPlaceholderText('click to add comment'),
    );

    expect(commentInput).toBe(document.activeElement);
  });

  test('KeyboardShortcut ctrl+shift+u: clear PinBoard', async () => {
    const { getByTitle } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    fireEvent.click(await waitFor(() => getByTitle('Pin job')));

    const pinnedJob = await waitFor(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );

    fireEvent.keyDown(pinnedJob, {
      key: 'u',
      keyCode: 85,
      ctrlKey: true,
      shiftKey: true,
    });

    expect(pinnedJob).not.toBeInTheDocument();
  });

  test('clear PinBoard', async () => {
    const { getByTitle, getByText } = render(testDetailsPanel());
    store.dispatch(setSelectedJob(jobList.data[1], true));

    fireEvent.click(await waitFor(() => getByTitle('Pin job')));

    const unPinJobBtn = await waitFor(() => getByTitle('Unpin job'));
    expect(unPinJobBtn).toBeInTheDocument();
    const pinnedJob = await waitFor(() =>
      getByTitle('build-android-api-16/debug - busted - 18 mins'),
    );
    fireEvent.click(getByTitle('Additional pinboard functions'));
    fireEvent.click(getByText('Clear all'));

    expect(pinnedJob).not.toBeInTheDocument();
  });

  test('pin all jobs', async () => {
    const { queryAllByTitle } = render(testDetailsPanel());
    store.dispatch(pinJobs(jobList.data));

    const unPinJobBtns = await waitFor(() => queryAllByTitle('Unpin job'));
    expect(unPinJobBtns).toHaveLength(5);
  });
});
