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
import {
  setPushes,
  updateJobMap,
} from '../../../../ui/job-view/redux/stores/pushes';
import reposFixture from '../../mock/repositories';
import KeyboardShortcuts from '../../../../ui/job-view/KeyboardShortcuts';
import { pinJobs } from '../../../../ui/job-view/redux/stores/pinnedJobs';

describe('DetailsPanel', () => {
  const repoName = 'autoland';
  const classificationBug = 98766789;
  const classificationTypes = [{ id: 4, name: 'intermittent' }];
  const classificationMap = { 4: 'intermittent' };
  let jobList = null;
  const selectedJobId = 259537372;
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

    fetchMock.get(
      getProjectUrl(`/jobs/${selectedJobId}/`, repoName),
      jobList.data[1],
    );
    fetchMock.get(
      getProjectUrl(`/note/?job_id=${selectedJobId}`, repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl(`/jobs/${selectedJobId}/text_log_errors/`, repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl(`/jobs/${selectedJobId}/bug_suggestions/`, repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl(`/bug-job-map/?job_id=${selectedJobId}`, repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl(`/performance/data/?job_id=${selectedJobId}`, repoName),
      [],
    );
    fetchMock.get(
      getProjectUrl(`/job-log-url/?job_id=${selectedJobId}`, repoName),
      [],
    );
    fetchMock.catch(
      getProjectUrl(`/job-log-url/?job_id=${selectedJobId}`, repoName),
      [],
    );
    fetchMock.post(getProjectUrl('/bug-job-map/', repoName), {
      bug_id: classificationBug,
      internal_bug_id: null,
      job_id: selectedJobId,
      type: 'annotation',
    });
    fetchMock.post(getProjectUrl('/note/', repoName), {
      text: '',
      who: null,
      failure_classification_id: 4,
      job_id: selectedJobId,
    });
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ/runs/0/artifacts',
      { artifacts: [] },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ',
      taskDefinition,
    );
    fetchMock.delete(getProjectUrl('/classification/', repoName), []);
    store = configureStore();
    store.dispatch(setPushes(pushFixture.results, {}, router));
    store.dispatch(updateJobMap(jobList.data));
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
                pushRoute: history.push,
                router,
              })
            }
            showOnScreenShortcuts={() => {}}
          >
            <div />
            <div id="th-global-content" data-testid="global-content">
              <DetailsPanel
                currentRepo={currentRepo}
                user={{ isLoggedIn: true, isStaff: true }}
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

  const checkClassifiedJobs = (expectedCount) => {
    const classifiedJobs = [];
    for (const job of jobList.data) {
      if (
        job.failure_classification_id > 1 &&
        jobList.failure_classification_id !== 6
      ) {
        classifiedJobs.push(job);
      }
    }
    expect(classifiedJobs).toHaveLength(expectedCount);
  };

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
    await waitFor(() => document.querySelector('#th-global-content'));
    const unPinJobBtns = queryAllByTitle('Unpin job');
    expect(unPinJobBtns).toHaveLength(5);
  });

  test('classify and unclassify all jobs', async () => {
    const {
      getByPlaceholderText,
      getByText,
      getByTitle,
      queryAllByTitle,
    } = render(testDetailsPanel());

    store.dispatch(pinJobs(jobList.data));
    store.dispatch(setSelectedJob(jobList.data[1], true));

    const content = await waitFor(() =>
      document.querySelector('#th-global-content'),
    );

    fireEvent.keyDown(content, { key: 'b', keyCode: 66 });
    const bugInput = await waitFor(() =>
      getByPlaceholderText('enter bug number'),
    );
    fireEvent.change(bugInput, { target: { value: classificationBug } });
    fireEvent.blur(bugInput);

    fetchMock.get(
      {
        url: getProjectUrl(`/bug-job-map/?job_id=${selectedJobId}`, repoName),
        overwriteRoutes: true,
      },
      [
        {
          job_id: selectedJobId,
          bug_id: classificationBug,
          created: '2022-01-05T18:13:16.285428',
          who: 'sheriff@example.org',
        },
      ],
    );
    fetchMock.get(
      {
        url: getProjectUrl(`/note/?job_id=${selectedJobId}`, repoName),
        overwriteRoutes: true,
      },
      [
        {
          id: 60,
          job_id: selectedJobId,
          failure_classification_id: 4,
          created: '2022-01-05T18:13:16.277619',
          who: 'sheriff@example.org',
          text: '',
        },
      ],
    );

    fireEvent.click(
      await waitFor(() => getByTitle('Save classification data')),
    );
    await waitFor(() =>
      getByTitle('Ineligible classification data / no pinned jobs'),
    );

    let unPinJobBtns = await waitFor(() => queryAllByTitle('Unpin job'));
    expect(unPinJobBtns).toHaveLength(0);
    checkClassifiedJobs(jobList.data.length);

    store.dispatch(pinJobs(jobList.data));
    fireEvent.click(
      await waitFor(() => getByTitle('Additional pinboard functions')),
    );
    fireEvent.click(await waitFor(() => getByText('Unclassify all')));
    await waitFor(() =>
      getByTitle('Ineligible classification data / no pinned jobs'),
    );
    unPinJobBtns = await waitFor(() => queryAllByTitle('Unpin job'));
    expect(unPinJobBtns).toHaveLength(0);
    checkClassifiedJobs(0);
  });
});
